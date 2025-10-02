
Option Explicit

Private Sub Workbook_Open()
    ' Оригинальная очистка
    On Error Resume Next
    Dim PMLastRow As Long, IPLastRow As Long
    PMLastRow = Sheet3.Cells(Sheet3.Rows.Count, 1).End(xlUp).Row
    IPLastRow = Sheet2.Cells(Sheet2.Rows.Count, 1).End(xlUp).Row
    If PMLastRow > 2 Then Sheet3.Range("A3", Sheet3.Cells(PMLastRow, 16)).ClearContents
    If IPLastRow > 2 Then Sheet2.Range("A3", Sheet2.Cells(IPLastRow, 16)).ClearContents
    On Error GoTo 0
    Debug.Print Format$(Now, "hh:nn:ss"), "[Workbook] opened (event-driven dumper ready)"
End Sub

Private Sub Workbook_SheetChange(ByVal Sh As Object, ByVal Target As Range)
    On Error Resume Next
    TryImmediateJsonDump
End Sub

Private Sub Workbook_SheetCalculate(ByVal Sh As Object)
    On Error Resume Next
    TryImmediateJsonDump
End Sub

Private Sub Workbook_BeforeClose(Cancel As Boolean)
    Debug.Print Format$(Now, "hh:nn:ss"), "[Workbook] closing"
End Sub
