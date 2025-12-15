#Requires AutoHotkey v2.0
;
; AutoHotkey v2 script: Template sync + coordinate writer for config159.ini
; Reads template_sync.json (template/map), auto-creates template section, writes LBx/RBx on Ctrl+hotkeys.

SetTitleMatchMode(2)
CoordMode "Mouse", "Screen"
; Make mouse moves/clicks as instant as possible
SetDefaultMouseSpeed(0)
SetMouseDelay(-1)

global gIniPath := A_ScriptDir "\\config159.ini"
global gSyncPath := A_ScriptDir "\\template_sync.json"
; File-signal path from Electron (main.js writes here)
global gSignalPath := A_ScriptDir "\\..\\desktop\\auto_press_signal.json"
global gSignalLastTs := 0

; Read hotkeys from INI
LBKey2 := IniRead(gIniPath, "Keyboard", "LBKey2", "NumpadSub")
; Current hotkey bindings (to support live reload on INI change)
global gKeyLB := "", gKeyRB := "", gKeyTpl := "", gKeyRT := ""
global gKeyExit := ""
RegisterHotkeys()

; --- Live watcher: show notifications on template/map changes ---
global gLastSyncSig := ""
global gOverrideTpl := ""  ; if not empty, overrides current template from JSON for actions
global gOverrideMap := 0    ; if >0, overrides current map from JSON for actions
global gIniMTime := ""
SetTimer(WatchSync, 400)
; Show initial state after load
SetTimer(() => (WatchSync(), 0), -300)
; Watch INI changes to rebind hotkeys live
SetTimer(WatchIni, 800)
; Watch external key signal file as an additional trigger channel (covers cases where F-keys are not intercepted)
SetTimer(CheckAutoSignal, 250)
; Help window hotkey (fixed): Numpad9
Hotkey("Numpad9", ShowHelp, "On")
; Global actions (fixed): Numpad1 = Suspend/Unsuspend, Numpad0 = Update
Hotkey("Numpad1", GlobalSuspend, "On")
Hotkey("Numpad0", GlobalUpdate, "On")
; Coordinate learning for global actions: Ctrl+Numpad1 / Ctrl+Numpad0
Hotkey("^Numpad1", SaveSuspend, "On")
Hotkey("^Numpad0", SaveUpdate, "On")
; External triggers (fixed): F23/LB, F24/RB, F22/Update, F21/Suspend
global gEmitGuardUntil := 0  ; timestamp (A_TickCount) until which inbound F-hotkeys are ignored
Hotkey("F23", OnF23, "On")
Hotkey("F24", OnF24, "On")
Hotkey("F22", OnF22, "On")
Hotkey("F21", OnF21, "On")

SaveLB(*) {
    global gOverrideTpl, gOverrideMap
    T := GetEffectiveTemplate()
    modes := IniRead(gIniPath, T, "Modes", "")
    if (modes = "")
        modes := ModesFromName(T)
    M := GetEffectiveMap(T, Integer(modes))
    if !T {
        Balloon("Empty template (template_sync.json?)")
        return
    }
    if (M < 1)
        M := 1
    if !EnsureTemplateSection(T, M)
        return
    MouseGetPos &x, &y
    IniWrite(x "," y, gIniPath, T, "LB" M)
    EnsureModesAtLeast(T, M)
    Balloon("[" T "] LB" M " = " x "," y " (saved)")
}

SaveRB(*) {
    global gOverrideTpl, gOverrideMap
    T := GetEffectiveTemplate()
    modes := IniRead(gIniPath, T, "Modes", "")
    if (modes = "")
        modes := ModesFromName(T)
    M := GetEffectiveMap(T, Integer(modes))
    if !T {
        Balloon("Empty template (template_sync.json?)")
        return
    }
    if (M < 1)
        M := 1
    if !EnsureTemplateSection(T, M)
        return
    MouseGetPos &x, &y
    IniWrite(x "," y, gIniPath, T, "RB" M)
    EnsureModesAtLeast(T, M)
    Balloon("[" T "] RB" M " = " x "," y " (saved)")
}

SaveSuspend(*) {
    global gIniPath
    MouseGetPos &x, &y
    IniWrite(x, gIniPath, "Joy3", "SuspendX")
    IniWrite(y, gIniPath, "Joy3", "SuspendY")
    Balloon("[Joy3] Suspend = " x "," y " (saved)")
}

SaveUpdate(*) {
    global gIniPath
    MouseGetPos &x, &y
    IniWrite(x, gIniPath, "Joy3", "UpdateX")
    IniWrite(y, gIniPath, "Joy3", "UpdateY")
    Balloon("[Joy3] Update = " x "," y " (saved)")
}

EnsureSection(*) {
    T := GetCurrentTemplate()
    M := GetCurrentMap()
    if !T {
        Balloon("Empty template (template_sync.json?)")
        return
    }
    if !M
        M := 1
    ok := EnsureTemplateSection(T, M, true)
    if ok
        Balloon("Section [" T "] ready (Modes ≥ " M ")")
}

ReapplyModesFromName(*) {
    T := GetCurrentTemplate()
    if !T
        return
    modes := ModesFromName(T)
    IniWrite(modes, gIniPath, T, "Modes")
    SeedLB_RB_Placeholders(T, modes)
    Balloon("[" T "] Modes := " modes)
}

; ---------- Action (no-CTRL) hotkeys ----------
LaunchLBClick(*) {
    ; emit signal for external listener, but avoid triggering our own F-hotkey handler
    GuardEmit(300)
    try Send "{F23}"
    DoClick("LB")
}
LaunchRBClick(*) {
    GuardEmit(300)
    try Send "{F24}"
    DoClick("RB")
}

DoClick(kind) {
    global gOverrideTpl, gOverrideMap
    ; Ensure Excel window is active before clicking
    if (!EnsureExcelActive()) {
        Balloon("Excel is not active — activation attempt failed")
        ; proceed anyway to avoid blocking, but likely click will miss target
    }
    T := GetEffectiveTemplate()
    if !T {
        Balloon("No template for click")
        return
    }
    modes := IniRead(gIniPath, T, "Modes", "")
    if (modes = "")
        modes := ModesFromName(T)
    M := GetEffectiveMap(T, Integer(modes))
    keyName := kind . M
    val := IniRead(gIniPath, T, keyName, "")
    if (val = "") {
        Balloon("No coordinates for " keyName " in [" T "]")
        return
    }
    if !RegExMatch(val, "^\s*(-?\d+)\s*,\s*(-?\d+)\s*$", &mm) {
        Balloon("Invalid coordinates format: " val)
        return
    }
    x := Integer(mm[1])
    y := Integer(mm[2])
    ; Save original cursor position, perform click, and restore cursor immediately
    MouseGetPos &ox, &oy
    try MouseMove x, y, 0
    try Click "Left"
    try MouseMove ox, oy, 0
    Balloon("Click " kind M ": " x "," y " (cursor restored)", 0.6)
}

CycleTemplate(*) {
    global gOverrideTpl, gOverrideMap
    ; Cycle through Global.Templates and set override
    list := IniRead(gIniPath, "Global", "Templates", "")
    arr := []
    for part in StrSplit(list, ",") {
        p := Trim(part)
        if (p != "")
            arr.Push(p)
    }
    if (arr.Length = 0) {
        Balloon("Templates list is empty")
        return
    }
    cur := GetEffectiveTemplate()
    idx := 0
    for i, p in arr
        if (p = cur) {
            idx := i
            break
        }
    nextIdx := idx >= 1 ? Mod(idx, arr.Length) + 1 : 1
    gOverrideTpl := arr[nextIdx]
    ; Persist as DefaultTemplate for next run
    IniWrite(gOverrideTpl, gIniPath, "Global", "DefaultTemplate")
    EnsureTemplateSection(gOverrideTpl, 1)
    Balloon("Template → [" gOverrideTpl "]")
}

CycleMap(*) {
    global gOverrideTpl, gOverrideMap
    T := GetEffectiveTemplate()
    if !T {
        Balloon("No template")
        return
    }
    modes := IniRead(gIniPath, T, "Modes", "")
    if (modes = "")
        modes := ModesFromName(T)
    modes := Integer(modes)
    curMap := GetEffectiveMap(T, modes)
    newMap := Mod(curMap, modes) + 1
    gOverrideMap := newMap
    EnsureTemplateSection(T, newMap)
    Balloon("Map → " newMap)
}

GetCurrentTemplate() {
    tpl := ""
    if FileExist(gSyncPath) {
        j := FileRead(gSyncPath)
        if RegExMatch(j, '"template"\s*:\s*"([^"]*)"', &m)
            tpl := m[1]
    }
    if !tpl
        tpl := IniRead(gIniPath, "Global", "DefaultTemplate", "")
    return SanitizeSectionName(tpl)
}

GetCurrentMap() {
    if !FileExist(gSyncPath)
        return 1
    j := FileRead(gSyncPath)
    if RegExMatch(j, '"map"\s*:\s*(\d+)', &m) {
        mId := Integer(m[1])
        return mId < 1 ? 1 : mId
    }
    return 1
}

GetEffectiveTemplate() {
    global gOverrideTpl
    return gOverrideTpl != "" ? gOverrideTpl : GetCurrentTemplate()
}

GetEffectiveMap(section := "", modes := 5) {
    global gOverrideMap
    m := gOverrideMap > 0 ? gOverrideMap : GetCurrentMap()
    if (m < 1)
        m := 1
    if (m > modes)
        m := modes
    return m
}

SanitizeSectionName(name) {
    name := RegExReplace(name, "[\[\]]", "")
    name := RegExReplace(name, "[^\w \-]", "")
    name := Trim(name)
    return name != "" ? name : "Template"
}

ModesFromName(name) {
    if RegExMatch(name, "i)Bo\s*(\d+)", &m) {
        n := Integer(m[1])
        if (n < 1)
            n := 1
        if (n > 5)
            n := 5
        return n
    }
    return 3
}

EnsureTemplateSection(section, minModes := 1, askIfNotFound := false) {
    modes := IniRead(gIniPath, section, "Modes", "")
    if (modes = "") {
        modes := ModesFromName(section)
        if askIfNotFound {
            def := modes
            ib := InputBox("Enter Modes (1..5) for [" section "]", "Create template", "w320 h160", def)
            if (ib.Result != "OK")
                return false
            try modes := Integer(ib.Value)
            catch
                modes := def
            modes := Max(1, Min(5, modes))
        }
        IniWrite(modes, gIniPath, section, "Modes")
        ; Append to Global.Templates
        list := IniRead(gIniPath, "Global", "Templates", "")
        newList := AppendUniqueCsv(list, section)
        IniWrite(newList, gIniPath, "Global", "Templates")
        SeedLB_RB_Placeholders(section, modes)
    }
    if Integer(modes) < minModes {
        IniWrite(minModes, gIniPath, section, "Modes")
        SeedLB_RB_Placeholders(section, minModes)
    }
    return true
}

SeedLB_RB_Placeholders(section, modes) {
    i := 1
    while (i <= modes) {
        lbv := IniRead(gIniPath, section, "LB" i, "")
        if (lbv = "")
            IniWrite("0,0", gIniPath, section, "LB" i)
        rbv := IniRead(gIniPath, section, "RB" i, "")
        if (rbv = "")
            IniWrite("0,0", gIniPath, section, "RB" i)
        i++
    }
}

EnsureModesAtLeast(section, n) {
    modes := IniRead(gIniPath, section, "Modes", "")
    if (modes = "" || Integer(modes) < n) {
        IniWrite(n, gIniPath, section, "Modes")
        SeedLB_RB_Placeholders(section, n)
    }
}

AppendUniqueCsv(list, item) {
    arr := []
    for part in StrSplit(list, ",") {
        p := Trim(part)
        if (p != "")
            arr.Push(p)
    }
    for p in arr
        if (p = item)
            return list ; already present
    arr.Push(item)
    out := ""
    for idx, p in arr
        out .= (idx = 1 ? "" : ",") p
    return out
}

Balloon(msg, seconds := 1.0) {
    try ToolTip(msg)
    try TrayTip(msg)
    SetTimer(() => (ToolTip(), TrayTip()), -Floor(seconds * 1000))
}

WatchSync(*) {
    global gSyncPath, gLastSyncSig
    if !FileExist(gSyncPath)
        return
    j := ""
    try j := FileRead(gSyncPath)
    catch
        return
    local tpl := "", mp := 1
    if RegExMatch(j, '"template"\s*:\s*"([^"]*)"', &m1)
        tpl := m1[1]
    if RegExMatch(j, '"map"\s*:\s*(\d+)', &m2)
        mp := Integer(m2[1])
    if (mp < 1)
        mp := 1
    tpl := SanitizeSectionName(tpl)
    sig := tpl "|" mp
    if (sig = gLastSyncSig)
        return
    gLastSyncSig := sig
    ; Ensure section exists and seeded
    EnsureTemplateSection(tpl, mp)
    ovr := (gOverrideTpl != "" || gOverrideMap > 0) ? " (OVR)" : ""
    Balloon("Current template: [" tpl "]  map: " mp ovr, 1.2)
}

WatchIni(*) {
    global gIniPath, gIniMTime
    if !FileExist(gIniPath)
        return
    cur := ""
    try cur := FileGetTime(gIniPath, "M")
    catch
        return
    if (gIniMTime = "") {
        gIniMTime := cur
        return
    }
    if (cur != gIniMTime) {
        gIniMTime := cur
        RegisterHotkeys(true)
    Balloon("INI updated — hotkeys reloaded", 1.0)
    }
}

RegisterHotkeys(rebind := false) {
    global gKeyLB, gKeyRB, gKeyTpl, gKeyRT, gKeyExit, gIniPath
    ; Read desired keys from INI
    LB := IniRead(gIniPath, "Keyboard", "LBKey2", "NumpadSub")
    RB := IniRead(gIniPath, "Keyboard", "RBKey2", "NumpadAdd")
    TPL := IniRead(gIniPath, "Keyboard", "TemplateSwitchKey", "NumpadDiv")
    RT := IniRead(gIniPath, "Keyboard", "RTKey", "NumpadMult")
    ; If rebind requested or keys changed — unbind old and bind new
    if (rebind || LB != gKeyLB || RB != gKeyRB || TPL != gKeyTpl || RT != gKeyRT) {
        ; Turn off old hotkeys
        if (gKeyLB != "") {
            Hotkey("^" gKeyLB, , "Off")
            Hotkey(gKeyLB, , "Off")
        }
        if (gKeyRB != "") {
            Hotkey("^" gKeyRB, , "Off")
            Hotkey(gKeyRB, , "Off")
        }
        if (gKeyTpl != "") {
            Hotkey("^" gKeyTpl, , "Off")
            Hotkey(gKeyTpl, , "Off")
        }
        if (gKeyRT != "") {
            Hotkey("^" gKeyRT, , "Off")
            Hotkey(gKeyRT, , "Off")
        }
        if (gKeyExit != "") {
            Hotkey(gKeyExit, , "Off")
        }
        ; Bind new
        Hotkey("^" LB, SaveLB, "On")
        Hotkey("^" RB, SaveRB, "On")
        Hotkey("^" TPL, EnsureSection, "On")
        Hotkey("^" RT, ReapplyModesFromName, "On")
        Hotkey(LB, LaunchLBClick, "On")
        Hotkey(RB, LaunchRBClick, "On")
        Hotkey(TPL, CycleTemplate, "On")
        Hotkey(RT, CycleMap, "On")
        ; Emergency exit
        ExitKey := IniRead(gIniPath, "Keyboard", "ExitKey", "SC029")
        Hotkey(ExitKey, EmergencyExit, "On")
        ; Store current
        gKeyLB := LB, gKeyRB := RB, gKeyTpl := TPL, gKeyRT := RT, gKeyExit := ExitKey
    }
}

EmergencyExit(*) {
    Balloon("Emergency exit", 0.6)
    ExitApp()
}

ShowHelp(*) {
    static help := 0
    if !IsObject(help) {
     help := Gui("+AlwaysOnTop +MinSize400x300", "script159 — Help")
     txt := "Hotkeys:" . "`n" .
         "  Ctrl+Numpad- — save LB{map}" . "`n" .
         "  Ctrl+Numpad+ — save RB{map}" . "`n" .
         "  Ctrl+Numpad1 — save Suspend (Joy3)" . "`n" .
         "  Ctrl+Numpad0 — save Update (Joy3)" . "`n" .
         "  Ctrl+Numpad/ — create/ensure section" . "`n" .
         "  Ctrl+Numpad* — recompute Modes by BoN" . "`n" .
         "  Numpad- — click LB{map}" . "`n" .
         "  Numpad+ — click RB{map}" . "`n" .
         "  Numpad/ — cycle template" . "`n" .
         "  Numpad* — cycle map" . "`n" .
         "  Numpad1 — Suspend/Unsuspend (global)" . "`n" .
         "  Numpad0 — Update (global)" . "`n" .
         "  External triggers: F23=LB, F24=RB, F22=Update, F21=Suspend" . "`n" .
         "  ` (or [Keyboard].ExitKey) — emergency exit"
        help.AddText("w360 h180", txt)
     global gTplLabel := help.AddText("x10 y+10 w360", "Current template: …")
     btnOpen := help.AddButton("w140", "Open README")
     btnClose := help.AddButton("x+10 w100", "Close")
        btnOpen.OnEvent("Click", (*) => Run('"' . A_ScriptDir . "\\README-template-sync.md" . '"'))
        btnClose.OnEvent("Click", (*) => help.Hide())
        help.OnEvent("Escape", (*) => help.Hide())
        help.OnEvent("Close", (*) => help.Hide())
    }
    try gTplLabel.Text := "Current template: [" GetEffectiveTemplate() "]"
    help.Show()
}

; ---------- Global actions ----------
GlobalSuspend(*) {
    global gIniPath
    GuardEmit(300)
    try Send "{F21}"
    sx := IniRead(gIniPath, "Joy3", "SuspendX", "")
    sy := IniRead(gIniPath, "Joy3", "SuspendY", "")
    if (sx = "" or sy = "") {
        Balloon("No SuspendX/SuspendY coordinates in [Joy3]")
        return
    }
    ux := IniRead(gIniPath, "Joy3", "UpdateX", "")
    uy := IniRead(gIniPath, "Joy3", "UpdateY", "")
    if (ux = "" or uy = "") {
        ; fallback to [Auto]
        ux := IniRead(gIniPath, "Auto", "ClickX", "")
        uy := IniRead(gIniPath, "Auto", "ClickY", "")
    }
    ; configurable delay between Suspend and Update
    delayMs := 100
    try delayMs := Integer(IniRead(gIniPath, "Keyboard", "SuspendUpdateDelayMs", "100"))
    catch {
        delayMs := 100
    }
    try {
        sxx := Integer(sx), syy := Integer(sy)
    } catch {
        Balloon("Invalid Suspend coordinates: " sx "," sy)
        return
    }
    ; Perform two clicks with one save/restore of cursor
    MouseGetPos &ox, &oy
    try {
        if (!EnsureExcelActive()) {
            Balloon("Excel is not active — activation attempt failed")
        }
        MouseMove sxx, syy, 0
        Click "Left"
        Sleep delayMs
        if (ux != "" and uy != "") {
            try {
                uxx := Integer(ux), uyy := Integer(uy)
                MouseMove uxx, uyy, 0
                Click "Left"
            } catch {
                ; ignore bad update coords
            }
        }
    } finally {
        MouseMove ox, oy, 0
    }
    Balloon("Suspend + Update", 0.6)
}

GlobalUpdate(*) {
    global gIniPath
    GuardEmit(300)
    try Send "{F22}"
    if (!EnsureExcelActive()) {
        Balloon("Excel is not active — activation attempt failed")
    }
    x := IniRead(gIniPath, "Joy3", "UpdateX", "")
    y := IniRead(gIniPath, "Joy3", "UpdateY", "")
    if (x = "" or y = "") {
        ; fallback to [Auto]
        x := IniRead(gIniPath, "Auto", "ClickX", "")
        y := IniRead(gIniPath, "Auto", "ClickY", "")
    }
    if (x = "" or y = "") {
        Balloon("No Update coordinates (Joy3.UpdateX/Y or Auto.ClickX/Y)")
        return
    }
    if !TryClickAt(x, y)
        Balloon("Invalid Update coordinates: " x "," y)
    else
        Balloon("Update: " x "," y, 0.6)
}

TryClickAt(x, y) {
    try {
        xx := Integer(x), yy := Integer(y)
        if (!EnsureExcelActive()) {
            Balloon("Excel is not active — activation attempt failed")
        }
        MouseGetPos &ox, &oy
        MouseMove xx, yy, 0
        Click "Left"
        MouseMove ox, oy, 0
        return true
    } catch {
        return false
    }
}

EnsureExcelActive() {
    ; Returns true if Excel window is active, otherwise tries to activate it (twice) and returns success
    global gIniPath
    title := IniRead(gIniPath, "Keyboard", "ExcelTitleContains", "")
    cls := IniRead(gIniPath, "Keyboard", "ExcelClass", "XLMAIN")
    exe := IniRead(gIniPath, "Keyboard", "ExcelExe", "EXCEL.EXE")
    crit := (title != "" ? (title " ") : "") . "ahk_class " . cls . " ahk_exe " . exe
    try {
        if WinActive(crit)
            return true
    ; Two activation attempts with brief delay (double activation as fallback)
        WinActivate crit
        Sleep 60
        WinActivate crit
        WinWaitActive crit, , 500
        return !!WinActive(crit)
    } catch {
        return false
    }
}

CheckAutoSignal(*) {
    try {
        file := gSignalPath
        if !FileExist(file)
            return
        content := FileRead(file, "UTF-8")
        ; Expect JSON like { "key":"F21","side":0,"ts":123456789 }
        local ts := 0, key := ""
        if RegExMatch(content, '"ts"\s*:\s*(\d+)', &mTs)
            ts := Integer(mTs[1])
        if (ts <= gSignalLastTs)
            return
        gSignalLastTs := ts
        if RegExMatch(content, '"key"\s*:\s*"(F2[1-4])"', &mKey)
            key := mKey[1]
        else {
            ; Legacy: map side to F23/F24 if key missing
            local side := -1
            if RegExMatch(content, '"side"\s*:\s*(\d+)', &mSide) {
                side := Integer(mSide[1])
                key := (side=1) ? "F24" : "F23"
            }
        }
        ; Dispatch without re-emitting F-keys
        if (key = "F21")
            OnF21()
        else if (key = "F22")
            OnF22()
        else if (key = "F23")
            OnF23()
        else if (key = "F24")
            OnF24()
    } catch {
        ; ignore parse errors
    }
}

; --------- Inbound external F-key handlers (no re-emission) ---------
OnF23(*) {
    global gEmitGuardUntil
    if (A_TickCount < gEmitGuardUntil)
        return
    DoClick("LB")
}
OnF24(*) {
    global gEmitGuardUntil
    if (A_TickCount < gEmitGuardUntil)
        return
    DoClick("RB")
}
OnF22(*) {
    global gIniPath, gEmitGuardUntil
    if (A_TickCount < gEmitGuardUntil)
        return
    x := IniRead(gIniPath, "Joy3", "UpdateX", "")
    y := IniRead(gIniPath, "Joy3", "UpdateY", "")
    if (x = "" or y = "") {
        x := IniRead(gIniPath, "Auto", "ClickX", "")
        y := IniRead(gIniPath, "Auto", "ClickY", "")
    }
    if (x = "" or y = "") {
        Balloon("No Update coordinates (Joy3.UpdateX/Y or Auto.ClickX/Y)")
        return
    }
    if !TryClickAt(x, y)
        Balloon("Invalid Update coordinates: " x "," y)
    else
        Balloon("Update: " x "," y, 0.6)
}
OnF21(*) {
    global gIniPath, gEmitGuardUntil
    if (A_TickCount < gEmitGuardUntil)
        return
    sx := IniRead(gIniPath, "Joy3", "SuspendX", "")
    sy := IniRead(gIniPath, "Joy3", "SuspendY", "")
    if (sx = "" or sy = "") {
        Balloon("No SuspendX/SuspendY coordinates in [Joy3]")
        return
    }
    ux := IniRead(gIniPath, "Joy3", "UpdateX", "")
    uy := IniRead(gIniPath, "Joy3", "UpdateY", "")
    if (ux = "" or uy = "") {
        ux := IniRead(gIniPath, "Auto", "ClickX", "")
        uy := IniRead(gIniPath, "Auto", "ClickY", "")
    }
    delayMs := 100
    try delayMs := Integer(IniRead(gIniPath, "Keyboard", "SuspendUpdateDelayMs", "100"))
    catch {
        delayMs := 100
    }
    try {
        sxx := Integer(sx), syy := Integer(sy)
    } catch {
        Balloon("Invalid Suspend coordinates: " sx "," sy)
        return
    }
    MouseGetPos &ox, &oy
    try {
        MouseMove sxx, syy, 0
        Click "Left"
        Sleep delayMs
        if (ux != "" and uy != "") {
            try {
                uxx := Integer(ux), uyy := Integer(uy)
                MouseMove uxx, uyy, 0
                Click "Left"
            } catch {
            }
        }
    } finally {
        MouseMove ox, oy, 0
    }
    Balloon("Suspend + Update", 0.6)
}

GuardEmit(ms := 250) {
    global gEmitGuardUntil
    try {
        gEmitGuardUntil := A_TickCount + Integer(ms)
    } catch {
        gEmitGuardUntil := A_TickCount + 250
    }
}
