# 🔧 План рефакторинга - Разбивка больших файлов

> Цель: разбить 5 самых больших файлов на модули ≤500 строк
> Дата создания: 08.01.2026

---

## 📊 Текущее состояние

| # | Файл | Строк | Целевой размер |
|---|------|-------|----------------|
| 1 | `tower-stats.js` | 1366 | ≤400 |
| 2 | `enemies/index.js` | 1173 | ≤400 |
| 3 | `enemy-renderer.js` | 1139 | ≤400 |
| 4 | `tower-combat.js` | 1092 | ≤400 |
| 5 | `game-controller.js` | 1089 | ≤400 |

---

## 1️⃣ tower-stats.js (1366 строк) → 4 модуля

**Путь:** `modules/game-panel/bottom-panel/tower-stats.js`

### Текущая структура:
```
TowerStatsMixin(Base)
├── updateBottomPanelStats(tower)         ~300 строк - отображение статов
├── updateStatDetailPopups(tower)         ~500 строк - базовые popup'ы
├── updateAbilityStatDetailPopups(tower)  ~140 строк - ability popup'ы
├── showTowerInBottomPanel(tower)         ~120 строк - инициализация панели
├── updateBiomeDisplay(tower)             ~115 строк - biome модификаторы
├── formatBiomeMods(modifiers)            ~30 строк
├── setMagicChargePercent(percent)        ~15 строк
├── updateMagicChargeUI(tower)            ~80 строк
├── getTowerEmoji(tower)                  ~15 строк
└── getTowerDisplayName(tower)            ~20 строк
```

### Целевая структура:
```
modules/game-panel/bottom-panel/
├── tower-stats.js              ~100 строк (главный mixin, композиция)
├── stat-display.js             ~350 строк
│   ├── updateBottomPanelStats()
│   ├── showTowerInBottomPanel()
│   ├── getTowerEmoji()
│   └── getTowerDisplayName()
│
├── stat-popups.js              ~400 строк
│   ├── updateStatDetailPopups()
│   └── helper функции для popup'ов
│
├── ability-popups.js           ~200 строк
│   ├── updateAbilityStatDetailPopups()
│   └── helper функции
│
└── biome-display.js            ~150 строк
    ├── updateBiomeDisplay()
    ├── formatBiomeMods()
    ├── setMagicChargePercent()
    └── updateMagicChargeUI()
```

### Зависимости:
- `stat-display.js` ← импортирует из tower-combat
- `stat-popups.js` ← импортирует stat-detail-builder
- `ability-popups.js` ← импортирует element-abilities
- `biome-display.js` ← без внешних зависимостей

---

## 2️⃣ enemies/index.js (1173 строк) → 5 модулей

**Путь:** `modules/enemies/index.js`

### Текущая структура:
```
class EnemyManager
├── constructor, init, reset, destroy     ~100 строк
├── onGameStart, onMapGenerated           ~30 строк
├── startNextWave, generateWaveComposition ~110 строк - волны
├── processSpawnQueue, spawnEnemyFromData  ~130 строк - спавн
├── spawnEnemy                             ~70 строк
├── updateEnemy, updateCorpse              ~90 строк - обновление
├── moveAlongPath                          ~40 строк - движение
├── updateEffects, handleFireSpread        ~80 строк - эффекты
├── damageEnemy                            ~170 строк - получение урона
├── applyElementEffects                    ~120 строк
├── applyDebuff                            ~40 строк
├── getNearbyEnemies                       ~30 строк
├── killEnemy, processMagicCascade         ~150 строк - смерть
├── enemyReachedBase                       ~20 строк
└── getEnemiesArray, getRenderData, getWaveInfo ~60 строк
```

### Целевая структура:
```
modules/enemies/
├── index.js                    ~250 строк (EnemyManager class, композиция)
│   ├── constructor, init, reset, destroy
│   ├── update() - вызывает модули
│   └── get методы
│
├── wave-manager.js             ~200 строк
│   ├── startNextWave()
│   ├── generateWaveComposition()
│   ├── processSpawnQueue()
│   └── wave state
│
├── spawner.js                  ~200 строк
│   ├── spawnEnemyFromData()
│   ├── spawnEnemy()
│   └── spawn helpers
│
├── movement.js                 ~150 строк
│   ├── updateEnemy()
│   ├── updateCorpse()
│   ├── moveAlongPath()
│   └── path helpers
│
├── damage.js                   ~250 строк
│   ├── damageEnemy()
│   ├── applyElementEffects()
│   ├── applyDebuff()
│   └── damage calculation helpers
│
└── death.js                    ~200 строк
    ├── killEnemy()
    ├── processMagicCascade()
    ├── enemyReachedBase()
    └── death event handlers
```

### Зависимости:
- `wave-manager.js` ← config/waves
- `spawner.js` ← config/enemies
- `damage.js` ← config/enemies/special, status-effects
- `death.js` ← config/enemies/special (Undead, Splitter)

---

## 3️⃣ enemy-renderer.js (1139 строк) → 4 модуля

**Путь:** `renderer/renderers/enemy-renderer.js`

### Текущая структура:
```
EnemyRendererMixin(Base)
├── _renderEnemies()                       ~150 строк - главный loop
├── _renderEnemyHealthBar()                ~25 строк
├── _renderEliteEffect()                   ~20 строк
├── _renderEnemyBody() + типы              ~120 строк - тела врагов
├── _renderFlyingWings()                   ~25 строк
├── _renderArmorPlates()                   ~40 строк
├── _renderBossIndicator()                 ~20 строк
├── _renderBleedEffect()                   ~20 строк
├── _renderEnemyStatusEffects() + эффекты  ~90 строк - статус эффекты
├── _renderMagicImmuneAura()               ~35 строк
├── _renderRegeneratingEffect()            ~35 строк
├── _renderShieldBubble()                  ~60 строк
├── _renderAuraEffects() + ауры            ~260 строк - wave ауры
├── _renderSwarmMindConnections()          ~60 строк
├── _renderPhasingEffect()                 ~60 строк
├── _renderUndeadEffect()                  ~70 строк
├── _renderSplitterIndicator()             ~60 строк
└── helpers (_getEtherealAlpha, etc.)      ~30 строк
```

### Целевая структура:
```
renderer/renderers/
├── enemy-renderer.js           ~200 строк (главный mixin, _renderEnemies)
│   ├── _renderEnemies() - главный loop
│   ├── _renderEnemyHealthBar()
│   └── _getEtherealAlpha(), helpers
│
├── enemy-body-renderer.js      ~200 строк
│   ├── _renderEnemyBody()
│   ├── _renderMinionBody()
│   ├── _renderScoutBody()
│   ├── _renderBruteBody()
│   ├── _renderSwarmlingBody()
│   └── _renderBossBody()
│
├── enemy-special-renderer.js   ~300 строк
│   ├── _renderEliteEffect()
│   ├── _renderFlyingWings()
│   ├── _renderArmorPlates()
│   ├── _renderBossIndicator()
│   ├── _renderMagicImmuneAura()
│   ├── _renderRegeneratingEffect()
│   ├── _renderShieldBubble()
│   ├── _renderPhasingEffect()
│   ├── _renderUndeadEffect()
│   └── _renderSplitterIndicator()
│
└── enemy-effects-renderer.js   ~350 строк
    ├── _renderEnemyStatusEffects()
    ├── _renderBurnEffect(), _renderPoisonEffect(), etc.
    ├── _renderBleedEffect()
    ├── _renderAuraEffects()
    ├── _renderHasteAura(), _renderFortifiedAura(), etc.
    └── _renderSwarmMindConnections()
```

### Подход к миксинам:
```javascript
// enemy-renderer.js
const { EnemyBodyMixin } = require('./enemy-body-renderer');
const { EnemySpecialMixin } = require('./enemy-special-renderer');
const { EnemyEffectsMixin } = require('./enemy-effects-renderer');

function EnemyRendererMixin(Base) {
  return EnemyEffectsMixin(
    EnemySpecialMixin(
      EnemyBodyMixin(
        class extends Base { /* main render */ }
      )
    )
  );
}
```

---

## 4️⃣ tower-combat.js (1092 строк) → 5 модулей

**Путь:** `modules/towers/tower-combat.js`

### Текущая структура:
```
// Normal Attack (Combo + Focus)
├── getComboConfig()                       ~20 строк
├── getFocusFireConfig()                   ~15 строк
├── initComboState()                       ~15 строк
├── updateComboDecay()                     ~30 строк
├── processComboHit()                      ~60 строк
├── getComboProjectileColor()              ~35 строк

// Main Combat Loop
├── updateTowerCombat()                    ~50 строк
├── isValidTarget()                        ~15 строк
├── findTarget()                           ~35 строк
├── performAttack()                        ~250 строк - ГЛАВНЫЙ!

// Lightning
├── updateLightningCharge()                ~25 строк

// Magic Attack (Charge + Overflow)
├── getMagicConfig()                       ~50 строк
├── initMagicState()                       ~25 строк
├── updateMagicShotCost()                  ~30 строк
├── setMagicChargePercent()                ~20 строк
├── updateMagicCharge()                    ~35 строк
├── isMagicReady()                         ~15 строк
├── consumeMagicCharge()                   ~25 строк
├── processArcaneOverflow()                ~55 строк

// Piercing Attack
├── getPiercingConfig()                    ~120 строк
├── initPiercingState()                    ~25 строк
├── updatePiercingDecay()                  ~25 строк
├── processPiercingHit()                   ~80 строк
├── getMomentumCritBonus()                 ~15 строк
└── getPiercingProjectileColor()           ~15 строк
```

### Целевая структура:
```
modules/towers/
├── tower-combat.js             ~200 строк (главный, exports)
│   ├── updateTowerCombat()
│   ├── isValidTarget()
│   ├── findTarget()
│   └── re-exports из модулей
│
├── attack-normal.js            ~200 строк
│   ├── getComboConfig()
│   ├── getFocusFireConfig()
│   ├── initComboState()
│   ├── updateComboDecay()
│   ├── processComboHit()
│   └── getComboProjectileColor()
│
├── attack-magic.js             ~250 строк
│   ├── getMagicConfig()
│   ├── initMagicState()
│   ├── updateMagicShotCost()
│   ├── setMagicChargePercent()
│   ├── updateMagicCharge()
│   ├── isMagicReady()
│   ├── consumeMagicCharge()
│   └── processArcaneOverflow()
│
├── attack-piercing.js          ~300 строк
│   ├── getPiercingConfig()
│   ├── initPiercingState()
│   ├── updatePiercingDecay()
│   ├── processPiercingHit()
│   ├── getMomentumCritBonus()
│   └── getPiercingProjectileColor()
│
└── attack-perform.js           ~300 строк
    └── performAttack() - разделить по типам атак
```

### Зависимости:
- `attack-normal.js` ← config/attacks/normal
- `attack-magic.js` ← config/attacks/magic
- `attack-piercing.js` ← config/attacks/piercing
- `attack-perform.js` ← все attack-*.js модули

---

## 5️⃣ game-controller.js (1089 строк) → 4 модуля

**Путь:** `modules/game-panel/game-controller.js`

### Текущая структура:
```
class GameController
├── constructor                            ~40 строк
├── init()                                 ~190 строк - элементы кэш!
├── setupResizeObserver(), resizeCanvas()  ~50 строк
├── getSerializedState()                   ~10 строк
├── setupScreenNavigation()                ~45 строк
├── resetGame()                            ~35 строк
├── showScreen()                           ~20 строк
├── initializeGame()                       ~90 строк
├── restoreFromSavedState()                ~15 строк
├── setupEventListeners()                  ~10 строк
├── updateTowerAffordability()             ~35 строк
├── updateTowerPriceDisplay()              ~15 строк
├── enterPlacementMode()                   ~30 строк
├── exitPlacementMode()                    ~25 строк
├── enterEnergyPlacementMode()             ~30 строк
├── exitEnergyPlacementMode()              ~25 строк
├── placeEnergyBuilding()                  ~35 строк
├── _calculateBuildingCenter()             ~25 строк
├── updateEnergyAffordability()            ~45 строк
├── setTowerAttackType()                   ~25 строк
├── setTowerElement()                      ~30 строк
├── upgradeSelectedTower()                 ~10 строк
├── sellSelectedTower()                    ~10 строк
├── updateUI()                             ~80 строк
├── updateWaveAurasDisplay()               ~45 строк
├── startRenderLoop(), stopRenderLoop()    ~30 строк
├── renderGame()                           ~25 строк
├── showOverlay(), hideOverlay()           ~20 строк
├── showError()                            ~15 строк
└── destroy()                              ~15 строк
```

### Целевая структура:
```
modules/game-panel/
├── game-controller.js          ~300 строк (главный class)
│   ├── constructor
│   ├── init() - вызывает модули
│   ├── destroy()
│   └── game loop методы
│
├── element-cache.js            ~250 строк
│   ├── cacheElements() - выделить из init()
│   ├── elements object
│   └── element getters
│
├── placement-controller.js     ~200 строк
│   ├── enterPlacementMode()
│   ├── exitPlacementMode()
│   ├── enterEnergyPlacementMode()
│   ├── exitEnergyPlacementMode()
│   ├── placeEnergyBuilding()
│   └── _calculateBuildingCenter()
│
├── affordability-controller.js ~150 строк
│   ├── updateTowerAffordability()
│   ├── updateTowerPriceDisplay()
│   └── updateEnergyAffordability()
│
└── screen-controller.js        ~150 строк
    ├── setupScreenNavigation()
    ├── showScreen()
    ├── showOverlay()
    ├── hideOverlay()
    └── showError()
```

### Подход: Composition over Mixins
```javascript
// game-controller.js
const { ElementCache } = require('./element-cache');
const { PlacementController } = require('./placement-controller');

class GameController {
  constructor(options) {
    this.elementCache = new ElementCache();
    this.placement = new PlacementController(this);
    // ...
  }
}
```

---

## 📋 Порядок выполнения

### Этап 1: tower-stats.js
1. [ ] Создать `stat-display.js`
2. [ ] Создать `stat-popups.js`
3. [ ] Создать `ability-popups.js`
4. [ ] Создать `biome-display.js`
5. [ ] Рефакторить `tower-stats.js` как композицию
6. [ ] Тесты

### Этап 2: tower-combat.js
1. [ ] Создать `attack-normal.js`
2. [ ] Создать `attack-magic.js`
3. [ ] Создать `attack-piercing.js`
4. [ ] Создать `attack-perform.js`
5. [ ] Рефакторить `tower-combat.js`
6. [ ] Тесты

### Этап 3: enemies/index.js
1. [ ] Создать `wave-manager.js`
2. [ ] Создать `spawner.js`
3. [ ] Создать `movement.js`
4. [ ] Создать `damage.js`
5. [ ] Создать `death.js`
6. [ ] Рефакторить `index.js`
7. [ ] Тесты

### Этап 4: enemy-renderer.js
1. [ ] Создать `enemy-body-renderer.js`
2. [ ] Создать `enemy-special-renderer.js`
3. [ ] Создать `enemy-effects-renderer.js`
4. [ ] Рефакторить `enemy-renderer.js`
5. [ ] Тесты

### Этап 5: game-controller.js
1. [ ] Создать `element-cache.js`
2. [ ] Создать `placement-controller.js`
3. [ ] Создать `affordability-controller.js`
4. [ ] Создать `screen-controller.js`
5. [ ] Рефакторить `game-controller.js`
6. [ ] Тесты

---

## ⚠️ Риски и митигация

| Риск | Митигация |
|------|-----------|
| Циклические зависимости | Использовать dependency injection |
| Broken imports | Делать один файл за раз, тестировать |
| this context в миксинах | Передавать context явно или использовать .call() |
| Performance | Минимизировать require() в hot paths |

---

## ✅ Критерии успеха

- [ ] Все файлы ≤500 строк
- [ ] Игра работает без ошибок
- [ ] Нет регрессий в функциональности
- [ ] Все exports сохранены (backward compatibility)
- [ ] Код легко читается и понимается

---

*Документ создан: 08.01.2026*
*Автор: GitHub Copilot*
