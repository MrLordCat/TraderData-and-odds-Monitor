# OddsMoni Desktop (Prototype)

Minimal Electron-based desktop application for monitoring sports betting odds and integrating a League of Legends statistics / stream helper module.

Fonts used: Inter (variable + regular/semi-bold fallback) with system fallbacks (system-ui, Segoe UI, Roboto, Helvetica Neue, Arial). Font files are git-ignored — only the CSS references remain.

## What it does (current / planned core capabilities)

This README intentionally kept short for now. More developer & build details will be added later.

—
Work in progress.

## Auto Press / Alignment Trigger (F23/F24 Strategy)

Автоматическое выравнивание теперь НЕ жмёт больше реальные '[' и ']'. Вместо этого:
- side 0 -> F23 (VK 0x86)
- side 1 -> F24 (VK 0x87)

Инъекция делается через PowerShell + user32 `keybd_event` (скрипт `sendKeyInject.ps1` генерируется при старте). Это даёт глобальные события, которые легко перехватываются AutoHotkey (v2) независимо от фокуса.

Если нужно вручную протестировать — нажмите '[' или ']' в окне приложения: внутренняя логика всё ещё вычислит side, и сгенерирует F23/F24 (но уже не отправит сами скобки программно).

### AHK v2 Hook (рекомендуется)

```ahk
; AHK v2 script fragment
; F23 -> '['  |  F24 -> ']'
F23:: Send "["
F24:: Send "]"

; (Опционально) лог в консоль
F23:: {
	Send "["
	ToolTip "F23 -> ["
	SetTimer () => ToolTip(), -800
}
F24:: {
	Send "]"
	ToolTip "F24 -> ]"
	SetTimer () => ToolTip(), -800
}
```

### JSON Файл Fallback

Если по какой-то причине F23/F24 не проходят (политика безопасности, PS заблокирован и т.п.), остаётся файл `auto_press_signal.json`:

```json
{"side":1,"ts":1700000000000}
```

AHK v2 пример опроса файла:
```ahk
file := A_ScriptDir "\\auto_press_signal.json"
lastTs := 0
SetTimer(CheckAutoPress, 200)

CheckAutoPress() {
	global file, lastTs
	if !FileExist(file)
		return
	content := FileRead(file, "UTF-8")
	if RegExMatch(content, '"side":(\d+)', &mSide) && RegExMatch(content, '"ts":(\d+)', &mTs) {
		ts := mTs[1]
		if (ts > lastTs) {
			lastTs := ts
			side := mSide[1]
			key := (side = 1) ? "]" : "["
			Send key
		}
	}
}
```

### Логи
- `[autoSim][mode]` – смена режима авто.
- `[autoSim][fireAttempt]` – попытка авто-триггера в рендерере.
- `[auto-press][ipc]` – IPC запрос в main.
- `[auto-press][ipc][si] SENT injVk …` – отправлен F23/F24 через SendInput.
- `[auto-press][hotkey]` / `[auto-press][hotkey][si]` – ручное нажатие скобок пользователем -> преобразовано в F23/F24.

Если нет `[si] SENT`, значит упало и должен появиться файл fallback.

## Burst Logic & Two-Step Confirm

Alignment now stages directional pulses (F23/F24 per side & raise/lower) followed by a single confirm key (F22). Renderers send directional presses with `noConfirm=true` so main does not auto-fire confirm; after all pulses the renderer explicitly schedules F22.

Pulse count scale (diff% vs target):
- >=15% -> 4 pulses
- >=7% -> 3 pulses
- >=5% -> 2 pulses
- otherwise -> 1 pulse

Confirm (F22) fires ~60–120ms after final directional pulse. AHK maps F22 to the commit action (e.g. controller macro). This lets large corrections complete faster while keeping minor tweaks light.

## Suspension / Resume Semantics

Automation disables when the Excel/dataservices feed stops changing (freeze timeout). A localStorage intent flag ensures only automatically suspended sessions auto-resume on feed change; manual disables stay off until re-enabled.

## Map Auto-Restore & Dataservices Fallback

Map selection (`lastMap`) & team names persist. After any navigation the main process replays `set-map` at 400/1400/3000/5000ms. Each preload re-applies the map (plus SPA mutation observer). Sometimes dataservices misses all early broadcasts, so extra safeguards were added:
* Preload logs `[map][recv] set-map -> N` on receipt.
* Extra reasserts at 4200/6000ms inside the handler.
* DOMContentLoaded fallback reasserts at 800/2000/4000/7000ms with `_ping_ds` to provoke a resend.

If you still need to manually re-select: capture `[map]` logs; absence of any `[map][recv]` means the view attached listeners after all sends — reload to reproduce with timings.

## Testing Checklist

1. Large diff (>=15%): expect 4 pulses then 1 confirm (see `[autoSim][fireAttempt] pulses=4`).
2. Mid diff (6%): 2 pulses.
3. Freeze suspend: stop Excel feed -> `[autoSim][suspend]`; no further pulses.
4. Auto resume: resume feed -> `[autoSim][resume]` only if last disable was automatic.
5. Map persistence: change to map 2, reload broker -> map 2 auto-restored <5s.
6. Dataservices fallback: verify `[map][ds][fallback]` logs at staged times; odds correspond to correct map.
7. Rivalry extraction: only winner market visible; no specials extracted.

## Extended Logging Reference

- `[map][recv]` – Preload received a `set-map` value.
- `[map][ds][fallback]` – Dataservices forced map reassert attempt.
- `[autoSim][fireAttempt]` – Renderer choosing pulse count.
- `[auto-press][ipc][si] SENT injVk ...` – Successful low-level key injection.
- `[autoSim][suspend]` / `[autoSim][resume]` – Freeze transitions.

Use these markers when tuning timing or diagnosing missed confirms.

