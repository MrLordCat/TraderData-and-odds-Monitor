Option Explicit

' =============== EVENT-DRIVEN DUMPER (on any change) ===============
' При любом изменении в любой вкладке книги (Workbook_SheetChange)
' вызываем TryImmediateJsonDump -> (throttle) -> DumpOnce.
' Больше НЕТ периодического таймера.
' ================================================================

Private Const OUT_FILENAME As String = "excel_dump.json"
Private Const SHEET_NAME As String = "InPlay FRONT"
Private Const DEBUG_LOG As Boolean = True
Private Const MIN_EVENT_INTERVAL_MS As Long = 120 ' защита от лавины при массовой вставке

Private mLastEventDumpAt As Double ' Excel serial времени последнего дампа
Private mWriteCount As Long
Private mPending As Boolean           ' есть ли отложенный дамп (хвостовая часть debounce)
Private mPendingScheduledAt As Double ' когда запланирован FlushPendingDump (serial)

' --- Публичные вызовы ---
Public Sub ForceExcelDump(): DumpOnce: End Sub
Public Sub DumpOddsNow(): DumpOnce: End Sub
Public Sub ForceJsonDump(): DumpOnce: End Sub
Public Sub TryImmediateJsonDump(): TryImmediateDump: End Sub ' алиас

Public Sub TryImmediateDump()
	On Error Resume Next
	Dim elapsedMs As Double
	If mLastEventDumpAt > 0 Then
		elapsedMs = (Now - mLastEventDumpAt) * 86400000#
		If elapsedMs < MIN_EVENT_INTERVAL_MS Then
			' В окно троттлинга – запланируем «хвостовой» дамп на конец интервала
			SchedulePendingDump (MIN_EVENT_INTERVAL_MS - elapsedMs)
			Exit Sub
		End If
	End If
	DumpOnce
	' Успешный немедленный дамп отменяет отложенный
	CancelPendingDump
End Sub

Private Sub DumpOnce()
	On Error GoTo fail
	Dim ws As Worksheet
	Set ws = ThisWorkbook.Worksheets(SHEET_NAME)
	If ws Is Nothing Then GoTo fail

	Dim tsSec As Long: tsSec = DateDiff("s", #1/1/1970#, Now)

	' РЯДЫ (основные 5 карт)
	Dim rows(): rows = Array(44, 190, 336, 482, 628)
	' Столбцы: B - label, C - status, M/N - odds1/odds2
	Dim i&, r&
	Dim sb As String
	sb = "{""timestamp"":" & tsSec & ",""source"":""excel"",""markets"":[]"
	sb = Left$(sb, Len(sb) - 1) & "[" ' заменить ] на [
	For i = 0 To UBound(rows)
		r = rows(i)
		Dim lbl$, statusRaw$, statusNorm$, o1$, o2$, id$
		lbl = SafeCell(ws, "B" & r)
		statusRaw = UCase$(SafeCell(ws, "C" & r))
		o1 = SafeCell(ws, "M" & r)
		o2 = SafeCell(ws, "N" & r)
		If lbl = "" Then lbl = "Map " & (i + 1) & " Winner"
		id = "map" & CStr(i + 1)
		If InStr(statusRaw, "SUSP") > 0 Then
			statusNorm = "suspended"
		ElseIf InStr(statusRaw, "CLOSE") > 0 Then
			statusNorm = "closed"
		Else
			statusNorm = "trading"
		End If
		If i > 0 Then sb = sb & ","
		sb = sb & "{""id"":""" & JEsc(id) & """,""label"":""" & JEsc(lbl) & """,""status"":""" & JEsc(statusNorm) & _
				 """,""odds1"":""" & JEsc(o1) & """,""odds2"":""" & JEsc(o2) & """}"
	Next
	sb = sb & "]}"

	Dim outPath$
	If Len(ThisWorkbook.Path) > 0 Then
		outPath = ThisWorkbook.Path & Application.PathSeparator & OUT_FILENAME
	Else
		outPath = Environ$("USERPROFILE") & "\Documents\" & OUT_FILENAME
	End If

	WriteAtomic outPath, sb
	mWriteCount = mWriteCount + 1
	mLastEventDumpAt = Now
	' Если пока писали файл – могли прийти ещё изменения и выставить mPending.
	' Сразу НЕ сбрасываем mPending здесь: если пользователь успел сделать ещё одно изменение
	' в последние миллисекунды записи, хвостовой вызов всё равно перезапишет файл более свежими данными.
	If (mWriteCount Mod 20) = 0 Then LogMsg "[Dump] writes=" & mWriteCount & " -> " & outPath
	Exit Sub
fail:
	LogMsg "[Dump ERROR] " & Err.Number & " " & Err.Description
End Sub

' ------- HELPERS -------
Private Function SafeCell(ws As Worksheet, addr$) As String
	On Error GoTo done
	Dim v: v = ws.Range(addr).Value
	If IsError(v) Or IsEmpty(v) Then Exit Function
	SafeCell = Trim$(CStr(v))
done:
End Function

Private Function JEsc(ByVal s$) As String
	Dim t$: t = s
	t = Replace(t, "\\", "\\\\")
	t = Replace(t, """", "\\""")
	t = Replace(t, vbCrLf, "\n")
	t = Replace(t, vbCr, "\n")
	t = Replace(t, vbLf, "\n")
	JEsc = t
End Function

Private Sub WriteAtomic(fullPath$, content$)
	On Error GoTo fail
	Dim fso As Object, tmp$, ts
	Set fso = CreateObject("Scripting.FileSystemObject")
	tmp = fullPath & ".part"
	Set ts = fso.CreateTextFile(tmp, True, False)
	ts.Write content: ts.Close
	If fso.FileExists(fullPath) Then fso.DeleteFile fullPath, True
	fso.MoveFile tmp, fullPath
	Exit Sub
fail:
	LogMsg "[Write FAIL] " & Err.Number & " " & Err.Description & " path=" & fullPath
End Sub

Private Sub LogMsg(msg$)
	If Not DEBUG_LOG Then Exit Sub
	On Error Resume Next
	Debug.Print Format$(Now, "hh:nn:ss"), msg
End Sub

' ------- Legacy stub (некоторый код может звать ExcelBuildSig) -------
Public Function ExcelBuildSig() As String
	ExcelBuildSig = CStr(Timer) ' stub (legacy safety)
End Function

' ================= Trailing Debounce Helpers =================
' Задача: если несколько изменений приходят быстрее MIN_EVENT_INTERVAL_MS, хотим всё равно
' получить финальное состояние (даже если пользователь перестал менять ячейки).
' Реализация: при попадании в троттлинг ставим/переназначаем Application.OnTime на конец окна.
' При новом событии внутри окна – переносим расписание.
' NB: Application.OnTime точность ~1 сек. В большинстве Excel она принимает дробные даты,
' но может округлять. Если вдруг задержка окажется длиннее ожидаемого (>=1s), можно уменьшить
' MIN_EVENT_INTERVAL_MS или заменить стратегию. Для наших 120–300мс это либо мгновенно (если
' округлится до ближайшей секунды в прошлом) либо до 1 сек. Допускаем.
'
Private Sub SchedulePendingDump(remainingMs As Double)
	On Error Resume Next
	Dim totalMs As Double
	totalMs = IIf(remainingMs > 0, remainingMs, MIN_EVENT_INTERVAL_MS)
	' Если уже запланировано – отменим и переназначим (обновляем «хвост»)
	If mPendingScheduledAt > 0 Then
		Application.OnTime EarliestTime:=mPendingScheduledAt, Procedure:="FlushPendingDump", Schedule:=False
	End If
	Dim delayDays As Double
	delayDays = (totalMs / 86400000#)
	mPendingScheduledAt = Now + delayDays
	mPending = True
	Application.OnTime EarliestTime:=mPendingScheduledAt, Procedure:="FlushPendingDump", Schedule:=True
	' Диагностика (в Immediate окно)
	If DEBUG_LOG Then Debug.Print Format$(Now, "hh:nn:ss"), "[Debounce] scheduled trailing dump in", CLng(totalMs), "ms"
End Sub

Private Sub CancelPendingDump()
	On Error Resume Next
	If mPendingScheduledAt > 0 Then
		Application.OnTime EarliestTime:=mPendingScheduledAt, Procedure:="FlushPendingDump", Schedule:=False
	End If
	mPendingScheduledAt = 0
	mPending = False
End Sub

Public Sub FlushPendingDump()
	On Error GoTo done
	Dim nowTs As Double: nowTs = Now
	mPendingScheduledAt = 0
	If Not mPending Then GoTo done
	mPending = False
	' Если всё ещё находимся внутри окна троттлинга относительно последнего реального дампа –
	' сместим ещё раз (редкий случай, если таймер сработал раньше из-за округления)
	Dim elapsedMs As Double
	elapsedMs = (nowTs - mLastEventDumpAt) * 86400000#
	If elapsedMs < MIN_EVENT_INTERVAL_MS Then
		SchedulePendingDump (MIN_EVENT_INTERVAL_MS - elapsedMs)
	Else
		DumpOnce
	End If
done:
End Sub

