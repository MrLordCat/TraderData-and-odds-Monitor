# Code Review Overview / Обзор Кода

Этот документ консолидирует ключевые моменты архитектуры проекта, роли основных файлов и доступные глобальные (общие) константы. Цель — быстрое ориентирование при ревью и добавлении новых функций.

## 1. Глобальные Константы (`modules/utils/constants.js`)
Экспортируемый объект:
- `VIEW_GAP` (8) — горизонтальный зазор между `BrowserView` брокеров и ячейками пресета.
- `SNAP_DISTANCE` (12) — порог пикселей для прилипания при drag/resize (используется broker/layout менеджерами).
- `STALE_MS` (5 * 60 * 1000) — таймаут «устаревших» коэффициентов (используется staleMonitor / auto refresh).
- `HEALTH_CHECK_INTERVAL` (60 * 1000) — период проверки свежести коэффициентов.
- `STATS_PANEL_WIDTH` (360) — базовая ширина докуемой/встроенной stats панели.
- `STATS_VIEW_GAP` (4) — внутренний отступ между подпредставлениями stats.

Все дополнительные «магические» числа следует по возможности поднимать сюда.

## 2. Главный Процесс (`main.js`)
Основные зоны ответственности:
- Инициализация приложения, одиночный инстанс, глобальные safety handlers (`unhandledRejection`, `uncaughtException`).
- Определение списка брокеров `BROKERS` и их стартовых URL, восстановление сохранённых URL (per broker) из `electron-store`.
- Управление окнами: главное окно (`mainWindow`), док-борда (через `boardManager`), встроенный/отдельный stats (через `statsManager`).
- Управление `BrowserView` брокеров: реестр `views` (id -> BrowserView), список активных брокеров `activeBrokerIds` (также обёрнут в ref для межмодульного доступа).
- Состояние коэффициентов: `latestOddsRef` (кэш последней пачки на брокера — для повторной отрисовки board/stats при реконнекте/детаче).
- Автообновление и свежесть: `brokerHealth` + константы `STALE_MS`, `HEALTH_CHECK_INTERVAL`; создаётся `staleMonitor` с автоматическим reload зависших брокеров.
- Перезапуск карты/команд после навигации: `scheduleMapReapply(view)` с множественными задержками (400/1400/3000/5000ms) для SPA/лентивых брокеров.
- Prompt для DataServices URL (`dsPromptView`) с блюром всех брокерских вью при открытии и очисткой CSS при закрытии.
- Горячие клавиши: `before-input-event` на окнах (Space для toggle stats, F12 / Ctrl+F12 DevTools, Alt+C disable auto, глобальные Control+Alt+L и Num5 через `globalShortcut`).
- Авто-нажатие (F22/F23/F24) через PowerShell script генерацию (`sendKeyInject.ps1`) + IPC `send-auto-press` с авто-confirm (F22) логикой.
- Создание и последовательная инициализация менеджеров: `layoutManager`, `brokerManager`, `boardManager`, `statsManager`, `upscalerManager`, `excelWatcher`.
- Модульный IPC: `early`, `brokers`, `layout`, `settings`, `map`, `board`, `teamNames`, `autoRefresh`, `stats`, `upscaler`.
- Встроенный vs window режим статистики: `statsState.mode` = `hidden|embedded|window`; embed НЕ удаляет брокерские views (избегается listener leak).

Главные рефы, передаваемые между менеджерами (паттерн `{ value: ... }`):
- `stageBoundsRef` — геометрия рабочей сцены (используется layout и stats). 
- `activeBrokerIdsRef` — актуальный список брокеров для layout/board.
- `latestOddsRef` — кэш odds.
- `lolTeamNamesRef` — текущие названия команд.
- `autoRefreshEnabledRef` — флаг авто-рефреша.
- `quittingRef` — устанавливается в `before-quit`, чтобы корректно останавливать фоновые процессы.

Прочее:
- `BROKER_FRAME_CSS` — единый стиль рамки для каждого брокерского `BrowserView` (вставляется на `did-finish-load`).
- Механика сохранения/восстановления: `electron-store` ключи: `disabledBrokers`, `layout`, `layoutPreset`, `lastUrls`, `lastMap`, `lolTeamNames`, `autoRefreshEnabled`, `mainBounds`, `siteCredentials`, `lastDataservicesUrl` и т.д.

## 3. Broker Manager (`modules/brokerManager/index.js`)
Функции:
- `createAll()` — создание всех активных брокеров (учитывает `disabledBrokers` + сохранённые bounds/URL; стартовое позиционирование перед применением layout пресета).
- `addBroker(id, urlOverride)` — добавляет брокера, при `dataservices` выполняет мульти-инъекцию карты и имён команд (250/900/1800ms). Реюзает bounds placeholder `slot-*`, если есть.
- `closeBroker(id)` — удаляет view, обновляет списки и запись в disabled.
- Внутренняя `createSingleInternal` — настройка UA + CDP override (`Emulation.setUserAgentOverride`), обработчики навигации, авто-применение кредов, контекстное меню (Back/Forward/Reload/DevTools/Inspect), вставка рамки CSS, интеграция с layout/zoom/stats z-order.
- Клавиатурные шорткаты в отдельном view: F12, F5, Ctrl+R, Space (с проверкой editable через `executeJavaScript`).
- Placeholder odds через `broadcastPlaceholderOdds` до поступления реальных данных.
- Политика ретраев загрузки: до 3 попыток `reloadIgnoringCache` с экспоненциальной задержкой (1.2s * попытка); затем страница ошибки `renderer/error.html`.

## 4. Layout Manager (`modules/layout/`)
(Детали кода не открыты в этом обзоре, паттерн из инструкций):
- Применяет пресеты вида `2x3`, `1x2x2` и т.п.
- Создаёт `slot-*` placeholder BrowserViews в пустых клетках.
- Управляет док-отступами (board/stats) через `setDockOffsets`.
- Предоставляет `sanitizeInitialBounds` и `clampViewToStage` для корректного позиционирования добавляемых брокеров.

## 5. Board Manager (`modules/board/`)
- Аггрегирует коэффициенты, вычисляет лучшую линию, mid, потенциальные арбитражи (исключая `dataservices`).
- Может быть докован / отделён (в коде присутствуют ссылки на `boardWindowRef`, но окно может отсутствовать, предпочтение docking).
- `sendOdds(payload)` рассылает обновления всем заинтересованным потребителям.

## 6. Stats Manager (`modules/stats/`)
- Режимы: embedded / window / hidden.
- Поддержка слотов A/B (например, для видео/upscaler) + панель.
- Метод `ensureTopmost()` гарантирует, что при появлении новых брокерских вью stats остаётся поверх (многоступенчатые таймауты 0/60/180/360ms).

## 7. (Удалено) Upscaler / FrameGen
Ранее присутствовал модуль апскейла/FrameGen для слота A. Полностью удалён: код, IPC, UI‑контролы и инъекции.

## 8. Excel Watcher (`modules/excelWatcher.js`)
- Наблюдает за внешним JSON (псевдо-брокер `excel`), парсит коэффициенты и транслирует их в общий поток как ещё один источник.
- Последняя пачка помещается в `global.__lastExcelOdds` и кэш `latestOddsRef`.

## 9. Stale Monitor (`modules/staleMonitor.js`)
- Периодически проверяет `brokerHealth[id].lastChange` / `lastRefresh` и если `now - lastChange > STALE_MS` вызывает `reloadIgnoringCache()` (если авто-рефреш включён).

## 10. Zoom Manager (`modules/zoom/`)
- Оборачивает логику `webContents.setZoomFactor` / user prefs на per-broker основе, прикрепляется к каждому view в `brokerManager`.

## 11. Настройки / Overlay (`modules/settingsOverlay/` и IPC)
- Рендерер `settings.html` через `settingsOverlay` как поверхностный BrowserView + блюр UI (`ui-blur-on/off`).
- Управление темой, контрастом, layout preset, включение/выключение брокеров.

## 12. IPC Модули (папка `modules/ipc/`)
Каналы (основные):
- `brokers` — добавление/закрытие, refresh, список активных.
- `layout` — применение пресета, обновление bounds/stage.
- `map` — выбор карты (`set-map`), флаги (`set-is-last`).
- `teamNames` — синхронизация названий команд.
- `board` — взаимодействие с док-панелью коэффициентов.
- `autoRefresh` — включение/выключение авто перезагрузок.
- `stats` — переключение режимов, обновления состояния.
- `upscaler` — режимы апскейла.
- `early` — ранние каналы до полной инициализации (например, placeholder events).

## 13. Extractors (`brokers/extractors.js`)
Экспорт:
- `getBrokerId(host)` — мапит hostname -> идентификатор брокера.
- `collectOdds(host, desiredMap)` — подбирает нужный extractor и возвращает `{ broker, odds:[o1,o2], frozen, ts, map }`.
- `deepQuery(selector, root)` — поиск внутри теневых DOM (используется в Rivalry extractor).

Особенности:
- Каждый `extract*` максимально устойчив к DOM изменениям: fallback цепочки, проверка наличия, возврат `['-','-']` при неуспехе.
- `frozen` вычисляется по разным критериям: pointer-events/opacity/классы suspension/lock и текстовые сигналы.
- Строгая политика для map рынков (не подставлять match winner если конкретный map рынок отсутствует) применена к нескольким брокерам (bet365, dataservices, marathon, и т.д.).

## 14. Preloads
Файлы (`preload.js`, `brokerPreload.js`, `slotPreload.js`, `addBrokerPreload.js`, `statsContentPreload.js`) обеспечивают мост `window.desktopAPI` и коммуникацию view <-> main через безопасный IPC. (Детали реализации см. при необходимости; стандарт: `contextIsolation: true`).

## 15. Рендерер (`renderer/`)
- `index.*` — базовый контейнер для брокерских views и встроенных панелей.
- `board.*` — UI аггрегированных коэффициентов (dock / detach).
- `stats_*` — скрипты для активности,Collapse,Config,Theme,Map,Embedded и пр.
- `add_broker.*` — диалог добавления брокера (использует slot placeholder). 
- `settings.*` — overlay настроек.
- `ds_url.*` — prompt для ввода DataServices URL.
- Глобальные стили: `common.css`, `main.css`, `toolbar.css` и т.п.

## 16. Управление Картой и Названиями Команд
- Сохраняется `lastMap`, `lolTeamNames`, `isLast` (флаг специфический для bet365 сценариев) в store.
- Повторная отправка на брокеров после навигаций (несколько задержек) + немедленная отправка при добавлении `dataservices`.

## 17. Безопасность / Устойчивость
- Всюду try/catch для защиты от неожиданных ошибок и снижению риска краша процесса.
- Ограниченные глобальные шорткаты во избежание конфликта с другими приложениями.
- Partition per broker: `partition: 'persist:<brokerId>'` для раздельных сессий (кэш/куки) + исключение `dataservices` принудительно через аргумент.

## 18. Расширение (Adding New Broker)
Шаги (согласно инструкциям):
1. Добавить `{ id, url }` в массив `BROKERS` (`main.js`).
2. Реализовать `extract<Name>` в `brokers/extractors.js` + добавить `test` / `fn` в `EXTRACTOR_TABLE`.
3. При необходимости донастроить `getBrokerId` для hostname.
4. Не рефакторить существующие селекторы без сохранения логики fallback и мягкого возврата `['-','-']`.

## 19. Добавление Новых Панелей / Отступов
- Использовать `layoutManager.setDockOffsets({ side:'right', width })` или аналогично (пример board/stats) вместо ручного перерасчёта bounds.

## 20. Ключевые Глобальные / Полуглобальные Структуры
- `views` — реестр `BrowserView` (ключ = brokerId или `slot-*`).
- `BROKERS` — статический список конфигураций брокеров.
- `latestOddsRef.value` — объект кэшов по брокеру.
- `brokerHealth` — время последнего изменения коэффициентов и последний reload.
- `loadFailures` — счётчик неудачных загрузок для fallback страницы.
- `statsState` — текущий режим stats.
- `stageBoundsRef.value` — координаты/размер сцены для layout.

## 21. Логи и Диагностика
- Авто-нажатия: `auto_press_debug.json`, `auto_press_confirm_debug.json`, `auto_press_signal.json`.
- Глобальный объект `__oddsMoniSync` (не перечисляемый) для быстрого доступа к ref-флагам.
- Возможность быстрого DevTools через F12 (активный брокер) или Ctrl+F12 (board webContents).

## 22. Потенциальные Риски / Области Внимания
- Listener leak при неправильном удалении/повторном добавлении BrowserViews (уже исправлено в стратеги stats embed — не удалять брокеров).
- Хрупкость селекторов в extractors при редизайне сайтов — важно иметь fallback слои, не уменьшать их.
- Асинхронные вставки CSS (blur) — корректная очистка через ожидание `__dsBlurKeyPromise` при закрытии prompt.
- Множественные timeouts для map/team replay — не сокращать без теста медленных брокеров (dataservices).

## 23. Рекомендации для Code Review
- Проверять новое использование «магических» чисел — двигать в `constants.js`.
- Убедиться, что любые новые IPC каналы оформлены отдельным файлом в `modules/ipc/` и инициализируются после зависимых менеджеров (см. порядок в `bootstrap()`).
- Любые операции с коллекцией views должны обновлять соответствующие рефы (`activeBrokerIdsRef`) и при необходимости вызывать `layoutManager.applyLayoutPreset`.
- При добавлении фоновой логики — учитывать `quittingRef` для корректного завершения.
- В extraction функциях: NO throw; всегда `try/catch` и `['-','-']` при сбое.

---
Обновляйте этот файл при структурных изменениях (новые менеджеры, IPC модули, критические константы) для сохранения актуальности обзора.
