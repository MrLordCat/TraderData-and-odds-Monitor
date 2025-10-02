Sub ShowDotaDraft()

If Sheet5.[G3] = "DOTA" Then
    DotaDraft.Show
End If

End Sub

Sub TradeIP()
Sheet2.[r3].value = ("OPEN")
Sheet9.[j1].value = ("TRADING")
TradeIP.BackColor = 13037518
[j1].Style = "Good"

End Sub

Sub SuspendIP()
Sheet2.[r3].value = ("SUSPENDED")
Sheet9.[j1].value = ("SUSPENDED")
[j1].Style = "Neutral"

End Sub

Sub CloseIP()
Sheet2.[r3].value = ("CLOSED")
Sheet9.[j1].value = ("CLOSED")
[j1].Style = "bad"

End Sub

Private Sub CommandButton1_Click()
Sheet2.[r3].value = ("SUSPENDED")
Sheet9.[j1].value = ("SUSPENDED")
[j1].Style = "Neutral"
End Sub

Private Sub CommandButton2_Click()
Sheet2.[r3].value = ("CLOSED")
Sheet9.[j1].value = ("CLOSED")
[j1].Style = "bad"
End Sub

Private Sub CommandButton3_Click()
Sheet2.[r3].value = ("OPEN")
Sheet9.[j1].value = ("TRADING")
CommandButton3.BackColor = 13037518
[j1].Style = "Good"
End Sub

Private Sub ToggleButton1_Click()
Dim LastRow As Integer
Dim Combo As Range

Application.ScreenUpdating = False

LastRow = Cells(rows.Count, 2).End(xlUp).Row

On Error GoTo Terminate
Set Combo = Range("a6", Cells(LastRow, 1)).SpecialCells(xlCellTypeConstants, 1)

        If ToggleButton1.value = True Then
            With Combo
                .Offset(0, 2).value = "Suspended"
                .Offset(0, 2).Style = "Neutral"
            End With
            ToggleButton1.BackColor = RGB(230, 230, 20)
            ToggleButton1.Caption = "Trade"
        Else
            With Combo
                .Offset(0, 2).value = "Trading"
                .Offset(0, 2).Style = "Good"
            End With
            ToggleButton1.BackColor = 13037518
            ToggleButton1.Caption = "Suspend"
        End If
               
Terminate:
End Sub

Private Sub Worksheet_Activate()

Application.OnKey "^~", "CustomSuspendKeybind" 'ctrl + enter
'Application.OnKey "^~", ""                     'set keybind to nothing
'Application.OnKey "^~"                         'set keybind to default

End Sub

Private Sub Worksheet_Deactivate()

'Application.OnKey "^~", "CustomSuspendKeybind" 'ctrl + enter
'Application.OnKey "^~", ""                     'set keybind to nothing
Application.OnKey "^~"                         'set keybind to default

End Sub

Private Sub Worksheet_Change(ByVal Target As Range)

Dim Tier As Integer
Dim Format As Integer
Tier = Sheet5.Range("G4")
Format = Sheet5.Range("G2")

    On Error Resume Next
    If MapNR = 0 Or MapNR > 99 Then
        If Target.Column = 4 Then
            MapNR = Target.Offset(0, 4)
        Else
            MapNR = Target.Offset(0, 3)
        End If
    End If
    On Error GoTo 0

If Not Intersect(Target, Me.Range("c1")) Is Nothing Then

Application.GoTo Reference:=Range("a1"), Scroll:=True ' scroll to top left corner

        Dim answer As Integer
        answer = MsgBox("Apply (" & [C1] & ") template?", vbYesNo, "Template")

            If answer = vbYes Then
                    Call ShowMapWinnerLinesOnly
                    Call IPResultingClearOldCraetedLines
                    Call IPResultRange
                    Call ResetMatchState
                    Call ResetTeamNames
                    Call MapWinnerSwitch
                    Call PMClearBias
                    
Application.Calculation = xlCalculationManual
                        'SUSPEND matches TRADING STATE
                        [j1].value = "Suspended"
                        [j1].Style = "Neutral"
                        Sheet2.[r3].value = "SUSPENDED"
                        
                        'Clear Biases
                        Sheet9.Range("J6:J800").ClearContents
                        
                        'clear active map from inplay models
                        Sheet7.Range("D3:D7").ClearContents
                        'clear R6 round scores
                        Sheet9.Range("M142:N142,M288:N288,M434:N434,M580:N580,M726:N726").ClearContents
                        'clear dota draft bias
                        Sheet9.Range("O111:O118,O125:O134,O257:O264,O271:O280,O403:O410,O417:O426,O549:O556,O563:O572,O695:O702,O709:O718").ClearContents
                        'clear dota draft bias from other games
                        Sheet9.Range("O72:O85,O87:O96,O151:O159,O218:O231,O233:O242,O297:O377,O364:O377,O379:O388,O443:O451,O510:O523,O525:O534,O589:O597,O656:O669,O671:O680,O735:O743").ClearContents
                        
                With Sheet11
                    .Range("C5:D5").ClearContents       'reset score in IPR
                    'clears round score from ipresulting / static
                    'cs
                    .Range("AV4:AW8").ClearContents     'Rounds score
                    .Range("AY4:BC67").ClearContents    'Round winners
                    .Range("AZ70:BC74").ClearContents   'Race winners
                    'lol
                    .Range("K2:T7").ClearContents       'Totals
                    .Range("K10:O13").ClearContents     'Races
                    .Range("Q16:T16").ClearContents     'Quadra Penta
                    .Range("V4:AT63").ClearContents     'Index
                    'dota2
                    .Range("BE3:BI12").ClearContents    'generic sidemarkets
                    .Range("BE15:BN20").ClearContents   'Totals
                    .Range("BE23:BH23").ClearContents   'ultra/rampage
                End With
Application.Calculation = xlCalculationAutomatic
            Else
            End If
                
            HideR6RoundScrollBars
            Shapes.Range(Array("Button 8012")).Visible = False   'dota draft button
            
            If Sheet5.[G3] = "DOTA" Then
                DOTA2TEAMS.Show
                Shapes.Range(Array("Button 8012")).Visible = True
            ElseIf Sheet5.[G3] = "COD" Or Sheet5.[G3] = "R6" Then
                UnhideR6RoundScrollBars
            ElseIf Sheet5.[G3] = "LOL" Then
                LOLTEAMS.Show
            ElseIf Sheet5.[G3] = "CSGO" And Sheet5.[g2] = 1 Then
                Sheet15.Range("L2") = "Map 1"
                CSGO_Map.Show
                ActiveSheet.Shapes("Button 5924").Visible = True
            ElseIf Sheet5.[G3] = "KOG" Then
                KOGTEAMS.Show
            End If

End If

        If Not Intersect(Target, Me.Range("M44")) Is Nothing Then
        
            If UCase(Range("M44")) = "VOID" Then
                'dont result map winner derivative main markets automatically. result manually
                CancelResultingForMainMarkets
        
            ElseIf UCase(Range("M44")) = "WIN" Or UCase(Range("M44")) = "LOSE" Then
                If Sheet5.Range("G3") = "CSGO" Or Sheet5.Range("G3") = "VAL" Then
                    Mapname = "Map 1 Winner"
                    Sheet9.Range("J44:J45").ClearContents
                    CSGO_RoundScore.Show
'                    With Sheet9
'                        Sheet7.Range("B69:C69").Value2 = .Range("M190:N190").Value2
'                        Sheet7.Range("B70:C70").Value2 = .Range("M336:N336").Value2
'                        Sheet7.Range("B71:C71").Value2 = .Range("M482:N482").Value2
'                        Sheet7.Range("B72:C72").Value2 = .Range("M628:N628").Value2
'                    End With
                End If
                
                If Sheet5.Range("G3") = "LOL" Or Sheet5.Range("G3") = "KOG" Then
                    Mapname = "MAP 1"
                    LoLPostMapStats.Show
                ElseIf Sheet5.Range("G3") = "DOTA" Then
                    Mapname = "MAP 1"
                    DotaPostMapStats.Show
                End If
              
            End If
            Call IPRMapScore
        End If

        If Not Intersect(Target, Me.Range("M190")) Is Nothing Then
        
            If UCase(Range("M190")) = "VOID" Then
                'dont result map winner derivative main markets automatically. result manually
                CancelResultingForMainMarkets
                
            ElseIf UCase(Range("M190")) = "WIN" Or UCase(Range("M190")) = "LOSE" Then
                'check if previous map is resulted
                If IsNumeric(Range("M44")) = True Then
                    MsgBox ("PREVIOUS MAP IS UNRESULTED")
                    End
                End If
                
                If Sheet5.Range("G3") = "CSGO" Or Sheet5.Range("G3") = "VAL" Then
                    Mapname = "Map 2 Winner"
                    CSGO_RoundScore.Show
'                    With Sheet9
'                        Sheet7.Range("B70:C70").Value2 = .Range("M336:N336").Value2
'                        Sheet7.Range("B71:C71").Value2 = .Range("M482:N482").Value2
'                        Sheet7.Range("B72:C72").Value2 = .Range("M628:N628").Value2
'                    End With
                End If
                
                If Sheet5.Range("G3") = "LOL" Or Sheet5.Range("G3") = "KOG" Then
                    Mapname = "MAP 2"
                    LoLPostMapStats.Show
                ElseIf Sheet5.Range("G3") = "DOTA" Then
                    Mapname = "MAP 2"
                    DotaPostMapStats.Show
                End If
            
            End If
            Call IPRMapScore
        End If

        If Not Intersect(Target, Me.Range("M336")) Is Nothing Then
        
            If UCase(Range("M336")) = "VOID" Then
                'dont result map winner derivative main markets automatically. result manually
                CancelResultingForMainMarkets
                        
            ElseIf UCase(Range("M336")) = "WIN" Or UCase(Range("M336")) = "LOSE" Then
                'check if previous map is resulted
                If IsNumeric(Range("M190")) = True Then
                    MsgBox ("PREVIOUS MAP IS UNRESULTED")
                    End
                End If
                
                If Sheet5.Range("G3") = "CSGO" Or Sheet5.Range("G3") = "VAL" Then
                    Mapname = "Map 3 Winner"
                    CSGO_RoundScore.Show
'                    With Sheet9
'                        Sheet7.Range("B71:C71").Value2 = .Range("M482:N482").Value2
'                        Sheet7.Range("B72:C72").Value2 = .Range("M628:N628").Value2
'                    End With
                End If
                
                If Sheet5.Range("G3") = "LOL" Or Sheet5.Range("G3") = "KOG" Then
                    Mapname = "MAP 3"
                    LoLPostMapStats.Show
                ElseIf Sheet5.Range("G3") = "DOTA" Then
                    Mapname = "MAP 3"
                    DotaPostMapStats.Show
                End If

            End If
            Call IPRMapScore
        End If

        If Not Intersect(Target, Me.Range("M482")) Is Nothing Then
        
            If UCase(Range("M482")) = "VOID" Then
                'dont result map winner derivative main markets automatically. result manually
                CancelResultingForMainMarkets
                              
            ElseIf UCase(Range("M482")) = "WIN" Or UCase(Range("M482")) = "LOSE" Then
                'check if previous map is resulted
                If IsNumeric(Range("M336")) = True Then
                    MsgBox ("PREVIOUS MAP IS UNRESULTED")
                    End
                End If
                
                If Sheet5.Range("G3") = "CSGO" Or Sheet5.Range("G3") = "VAL" Then
                    Mapname = "Map 4 Winner"
                    CSGO_RoundScore.Show
'                    With Sheet9
'                        Sheet7.Range("B72:C72").Value2 = .Range("M628:N628").Value2
'                    End With
                End If
                
                If Sheet5.Range("G3") = "LOL" Or Sheet5.Range("G3") = "KOG" Then
                    Mapname = "MAP 4"
                    LoLPostMapStats.Show
                ElseIf Sheet5.Range("G3") = "DOTA" Then
                    Mapname = "MAP 4"
                    DotaPostMapStats.Show
                End If
                
            End If
            Call IPRMapScore
        End If

        If Not Intersect(Target, Me.Range("M628")) Is Nothing Then
        
            If UCase(Range("M628")) = "VOID" Then
                'dont result map winner derivative main markets automatically. result manually
                CancelResultingForMainMarkets
                            
            ElseIf UCase(Range("M628")) = "WIN" Or UCase(Range("M628")) = "LOSE" Then
                'check if previous map is resulted
                If IsNumeric(Range("M482")) = True Then
                    MsgBox ("PREVIOUS MAP IS UNRESULTED")
                    End
                End If
                
                If Sheet5.Range("G3") = "CSGO" Or Sheet5.Range("G3") = "VAL" Then
                    Mapname = "Map 5 Winner"
                    CSGO_RoundScore.Show
                End If
                
                If Sheet5.Range("G3") = "LOL" Or Sheet5.Range("G3") = "KOG" Then
                    Mapname = "MAP 5"
                    LoLPostMapStats.Show
                ElseIf Sheet5.Range("G3") = "DOTA" Then
                    Mapname = "MAP 5"
                    DotaPostMapStats.Show
                End If
            
            End If
            Call IPRMapScore
        End If
        
        If Not Intersect(Target, Me.Range("M774")) Is Nothing Then
            If UCase(Range("M774")) = "WIN" Or UCase(Range("M774")) = "LOSE" Then
            End If
            Call IPRMapScore
        End If

        If Not Intersect(Target, Me.Range("M775")) Is Nothing Then
            If UCase(Range("M775")) = "WIN" Or UCase(Range("M775")) = "LOSE" Then
            End If
            Call IPRMapScore
        End If

''''''''''''''''''''''''''''''''
'manual hcp/index change trigger

If Sheet5.Range("G3") = "CSGO" Then

    If MapNR = 1 Then
        'map 1
        If Not Intersect(Target, Range("E63")) Is Nothing Then ' cs next round
            Set Index_Pos = Range("E63")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("D50")) Is Nothing Then 'rounds hcp
            Set Index_Pos = Range("D50")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D51")) Is Nothing Then
            Set Index_Pos = Range("D51")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D52")) Is Nothing Then
            Set Index_Pos = Range("D52")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D55")) Is Nothing Then ' manual hcp
            Set Index_Pos = Range("D55")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D56")) Is Nothing Then ' rounds ou
            Set Index_Pos = Range("D56")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D57")) Is Nothing Then
            Set Index_Pos = Range("D57")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D58")) Is Nothing Then
            Set Index_Pos = Range("D58")
            Call GoToNextHCPLine
        End If
    
    ElseIf MapNR = 2 Then
        'map 2
        If Not Intersect(Target, Range("E209")) Is Nothing Then ' cs next round
            Set Index_Pos = Range("E209")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("D196")) Is Nothing Then 'rounds hcp
            Set Index_Pos = Range("D196")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D197")) Is Nothing Then
            Set Index_Pos = Range("D197")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D198")) Is Nothing Then
            Set Index_Pos = Range("D198")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D201")) Is Nothing Then 'manual hcp
            Set Index_Pos = Range("D201")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D202")) Is Nothing Then 'rounds ou
            Set Index_Pos = Range("D202")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D203")) Is Nothing Then
            Set Index_Pos = Range("D203")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D204")) Is Nothing Then
            Set Index_Pos = Range("D204")
            Call GoToNextHCPLine
        End If
        
    ElseIf MapNR = 3 Then
        'map 3
        If Not Intersect(Target, Range("E355")) Is Nothing Then ' cs next round
            Set Index_Pos = Range("E355")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("D342")) Is Nothing Then 'rounds hcp
            Set Index_Pos = Range("D342")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D343")) Is Nothing Then
            Set Index_Pos = Range("D343")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D344")) Is Nothing Then
            Set Index_Pos = Range("D344")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D347")) Is Nothing Then 'manual hcp
            Set Index_Pos = Range("D347")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D348")) Is Nothing Then 'rounds ou
            Set Index_Pos = Range("D348")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D349")) Is Nothing Then
            Set Index_Pos = Range("D349")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D350")) Is Nothing Then
            Set Index_Pos = Range("D350")
            Call GoToNextHCPLine
        End If
    
    ElseIf MapNR = 4 Then
        'map 4
        If Not Intersect(Target, Range("E501")) Is Nothing Then ' cs next round
            Set Index_Pos = Range("E501")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("D488")) Is Nothing Then 'rounds hcp
            Set Index_Pos = Range("D488")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D489")) Is Nothing Then
            Set Index_Pos = Range("D489")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D490")) Is Nothing Then
            Set Index_Pos = Range("D490")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D493")) Is Nothing Then 'manual hcp
            Set Index_Pos = Range("D493")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D494")) Is Nothing Then 'rounds ou
            Set Index_Pos = Range("D494")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D495")) Is Nothing Then
            Set Index_Pos = Range("D495")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D496")) Is Nothing Then
            Set Index_Pos = Range("D496")
            Call GoToNextHCPLine
        End If
    ElseIf MapNR = 5 Then
        'map 5
        If Not Intersect(Target, Range("E647")) Is Nothing Then ' cs next round
            Set Index_Pos = Range("E647")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("D634")) Is Nothing Then 'rounds hcp
            Set Index_Pos = Range("D634")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D635")) Is Nothing Then
            Set Index_Pos = Range("D635")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D636")) Is Nothing Then
            Set Index_Pos = Range("D636")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D639")) Is Nothing Then 'manual hcp
            Set Index_Pos = Range("D639")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D640")) Is Nothing Then 'rounds ou
            Set Index_Pos = Range("D640")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D641")) Is Nothing Then
            Set Index_Pos = Range("D641")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D642")) Is Nothing Then
            Set Index_Pos = Range("D642")
            Call GoToNextHCPLine
        End If
    End If
''''''''

    If Tier > 1 Then
    
        If MapNR = 1 Then
        'map 1
            If Not Intersect(Target, Range("D48")) Is Nothing Then 'rounds hcp
                Set Index_Pos = Range("D48")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D49")) Is Nothing Then
                Set Index_Pos = Range("D49")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D53")) Is Nothing Then
                Set Index_Pos = Range("D53")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D54")) Is Nothing Then
                Set Index_Pos = Range("D54")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D59")) Is Nothing Then 'rounds ou
                Set Index_Pos = Range("D59")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D60")) Is Nothing Then
                Set Index_Pos = Range("D60")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D61")) Is Nothing Then
                Set Index_Pos = Range("D61")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D62")) Is Nothing Then
                Set Index_Pos = Range("D62")
                Call GoToNextHCPLine
            End If
        ElseIf MapNR = 2 Then
            'map 2
            If Not Intersect(Target, Range("D194")) Is Nothing Then 'rounds hcp
                Set Index_Pos = Range("D194")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D195")) Is Nothing Then
                Set Index_Pos = Range("D195")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D199")) Is Nothing Then
                Set Index_Pos = Range("D199")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D200")) Is Nothing Then
                Set Index_Pos = Range("D200")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D205")) Is Nothing Then 'rounds ou
                Set Index_Pos = Range("D205")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D206")) Is Nothing Then
                Set Index_Pos = Range("D206")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D207")) Is Nothing Then
                Set Index_Pos = Range("D207")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D208")) Is Nothing Then
                Set Index_Pos = Range("D208")
                Call GoToNextHCPLine
            End If
        ElseIf MapNR = 3 Then
            'map 3
            If Not Intersect(Target, Range("D340")) Is Nothing Then 'rounds hcp
                Set Index_Pos = Range("D340")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D341")) Is Nothing Then
                Set Index_Pos = Range("D341")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D345")) Is Nothing Then
                Set Index_Pos = Range("D345")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D346")) Is Nothing Then
                Set Index_Pos = Range("D346")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D351")) Is Nothing Then 'rounds ou
                Set Index_Pos = Range("D351")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D352")) Is Nothing Then
                Set Index_Pos = Range("D352")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D353")) Is Nothing Then
                Set Index_Pos = Range("D353")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D354")) Is Nothing Then
                Set Index_Pos = Range("D354")
                Call GoToNextHCPLine
            End If
        ElseIf MapNR = 4 Then
            'map 4
            If Not Intersect(Target, Range("D486")) Is Nothing Then 'rounds hcp
                Set Index_Pos = Range("D486")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D487")) Is Nothing Then
                Set Index_Pos = Range("D487")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D491")) Is Nothing Then
                Set Index_Pos = Range("D491")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D492")) Is Nothing Then
                Set Index_Pos = Range("D492")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D497")) Is Nothing Then 'rounds ou
                Set Index_Pos = Range("D497")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D498")) Is Nothing Then
                Set Index_Pos = Range("D498")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D499")) Is Nothing Then
                Set Index_Pos = Range("D499")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D500")) Is Nothing Then
                Set Index_Pos = Range("D500")
                Call GoToNextHCPLine
            End If
        ElseIf MapNR = 5 Then
            'map 5
            If Not Intersect(Target, Range("D632")) Is Nothing Then 'rounds hcp
                Set Index_Pos = Range("D632")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D633")) Is Nothing Then
                Set Index_Pos = Range("D633")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D637")) Is Nothing Then
                Set Index_Pos = Range("D637")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D638")) Is Nothing Then
                Set Index_Pos = Range("D638")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D643")) Is Nothing Then 'rounds ou
                Set Index_Pos = Range("D643")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D644")) Is Nothing Then
                Set Index_Pos = Range("D644")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D645")) Is Nothing Then
                Set Index_Pos = Range("D645")
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D646")) Is Nothing Then
                Set Index_Pos = Range("D646")
                Call GoToNextHCPLine
            End If
        End If
    End If
'''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''

ElseIf Sheet5.Range("G3") = "LOL" Then

    If MapNR = 1 Then
    ' next kill
        If Not Intersect(Target, Range("E73")) Is Nothing Then
            Set Index_Pos = Range("E73")
            Call GoToNextIndexLine
        End If
    'next dragon
        If Not Intersect(Target, Range("E75")) Is Nothing Then
            Set Index_Pos = Range("E75")
            Call GoToNextIndexLine
        End If
    'next baron
        If Not Intersect(Target, Range("E77")) Is Nothing Then
            Set Index_Pos = Range("E77")
            Call GoToNextIndexLine
        End If
    ' kills hcp
        If Not Intersect(Target, Range("D87")) Is Nothing Then
            Set Index_Pos = Range("D87")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D88")) Is Nothing Then
            Set Index_Pos = Range("D88")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D89")) Is Nothing Then
            Set Index_Pos = Range("D89")
            Call GoToNextHCPLine
        End If
    'kills over/under
        If Not Intersect(Target, Range("D91")) Is Nothing Then
            Set Index_Pos = Range("D91")
            Call GoToNextHCPLine
        End If
    'towers over/under
        If Not Intersect(Target, Range("D92")) Is Nothing Then
            Set Index_Pos = Range("D92")
            Call GoToNextHCPLine
        End If
    'dragons over/under
        If Not Intersect(Target, Range("D93")) Is Nothing Then
            Set Index_Pos = Range("D93")
            Call GoToNextHCPLine
        End If
    'barons over/under
        If Not Intersect(Target, Range("D94")) Is Nothing Then
            Set Index_Pos = Range("D94")
            Call GoToNextHCPLine
        End If
    'inhibitors over/under
        If Not Intersect(Target, Range("D95")) Is Nothing Then
            Set Index_Pos = Range("D95")
            Call GoToNextHCPLine
        End If
    'game time over/under
        If Not Intersect(Target, Range("D96")) Is Nothing Then
            Set Index_Pos = Range("D96")
            Call GoToNextHCPLine
        End If
    ElseIf MapNR = 2 Then
        If Not Intersect(Target, Range("E219")) Is Nothing Then
            Set Index_Pos = Range("E219")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("E221")) Is Nothing Then
            Set Index_Pos = Range("E221")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("E223")) Is Nothing Then
            Set Index_Pos = Range("E223")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("D233")) Is Nothing Then
            Set Index_Pos = Range("D233")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D234")) Is Nothing Then
            Set Index_Pos = Range("D234")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D235")) Is Nothing Then
            Set Index_Pos = Range("D235")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D237")) Is Nothing Then
            Set Index_Pos = Range("D237")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D238")) Is Nothing Then
            Set Index_Pos = Range("D238")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D239")) Is Nothing Then
            Set Index_Pos = Range("D239")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D240")) Is Nothing Then
            Set Index_Pos = Range("D240")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D241")) Is Nothing Then
            Set Index_Pos = Range("D241")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D242")) Is Nothing Then
            Set Index_Pos = Range("D242")
            Call GoToNextHCPLine
        End If
    ElseIf MapNR = 3 Then
        If Not Intersect(Target, Range("E365")) Is Nothing Then
            Set Index_Pos = Range("E365")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("E367")) Is Nothing Then
            Set Index_Pos = Range("E367")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("E369")) Is Nothing Then
            Set Index_Pos = Range("E369")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("D379")) Is Nothing Then
            Set Index_Pos = Range("D379")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D380")) Is Nothing Then
            Set Index_Pos = Range("D380")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D381")) Is Nothing Then
            Set Index_Pos = Range("D381")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D383")) Is Nothing Then
            Set Index_Pos = Range("D383")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D384")) Is Nothing Then
            Set Index_Pos = Range("D384")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D385")) Is Nothing Then
            Set Index_Pos = Range("D385")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D386")) Is Nothing Then
            Set Index_Pos = Range("D386")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D387")) Is Nothing Then
            Set Index_Pos = Range("D387")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D388")) Is Nothing Then
            Set Index_Pos = Range("D388")
            Call GoToNextHCPLine
        End If
    ElseIf MapNR = 4 Then
        If Not Intersect(Target, Range("E511")) Is Nothing Then
            Set Index_Pos = Range("E511")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("E513")) Is Nothing Then
            Set Index_Pos = Range("E513")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("E515")) Is Nothing Then
            Set Index_Pos = Range("E515")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("D525")) Is Nothing Then
            Set Index_Pos = Range("D525")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D526")) Is Nothing Then
            Set Index_Pos = Range("D526")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D527")) Is Nothing Then
            Set Index_Pos = Range("D527")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D529")) Is Nothing Then
            Set Index_Pos = Range("D529")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D530")) Is Nothing Then
            Set Index_Pos = Range("D530")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D531")) Is Nothing Then
            Set Index_Pos = Range("D531")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D532")) Is Nothing Then
            Set Index_Pos = Range("D532")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D533")) Is Nothing Then
            Set Index_Pos = Range("D533")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D534")) Is Nothing Then
            Set Index_Pos = Range("D534")
            Call GoToNextHCPLine
        End If
    ElseIf MapNR = 5 Then
        If Not Intersect(Target, Range("E657")) Is Nothing Then
            Set Index_Pos = Range("E657")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("E659")) Is Nothing Then
            Set Index_Pos = Range("E659")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("E661")) Is Nothing Then
            Set Index_Pos = Range("E661")
            Call GoToNextIndexLine
        End If
        If Not Intersect(Target, Range("D671")) Is Nothing Then
            Set Index_Pos = Range("D671")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D672")) Is Nothing Then
            Set Index_Pos = Range("D672")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D673")) Is Nothing Then
            Set Index_Pos = Range("D673")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D675")) Is Nothing Then
            Set Index_Pos = Range("D675")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D676")) Is Nothing Then
            Set Index_Pos = Range("D676")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D677")) Is Nothing Then
            Set Index_Pos = Range("D677")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D678")) Is Nothing Then
            Set Index_Pos = Range("D678")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D679")) Is Nothing Then
            Set Index_Pos = Range("D679")
            Call GoToNextHCPLine
        End If
        If Not Intersect(Target, Range("D680")) Is Nothing Then
            Set Index_Pos = Range("D680")
            Call GoToNextHCPLine
        End If
    End If
    
ElseIf Sheet5.Range("G3") = "DOTA" Then

    If MapNR = 1 Then
        If Tier > 1 Then
            If Not Intersect(Target, Range("D120:D132")) Is Nothing Then
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D134")) Is Nothing Then
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
        Else
            If Not Intersect(Target, Range("D122")) Is Nothing Then 'kills hcp
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D127")) Is Nothing Then 'kills ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D130")) Is Nothing Then 'towers ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D132")) Is Nothing Then 'rosh ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D134")) Is Nothing Then 'game time ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
        End If
    ElseIf MapNR = 2 Then
        If Tier > 1 Then
            If Not Intersect(Target, Range("D266:D278")) Is Nothing Then
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D280")) Is Nothing Then
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
        Else
            If Not Intersect(Target, Range("D268")) Is Nothing Then 'kills hcp
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D273")) Is Nothing Then 'kills ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D276")) Is Nothing Then 'towers ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D278")) Is Nothing Then 'rosh ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D280")) Is Nothing Then 'game time ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
        End If
    ElseIf MapNR = 3 Then
        If Tier > 1 Then
            If Not Intersect(Target, Range("D412:D424")) Is Nothing Then
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D426")) Is Nothing Then
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
        Else
            If Not Intersect(Target, Range("D414")) Is Nothing Then 'kills hcp
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D419")) Is Nothing Then 'kills ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D422")) Is Nothing Then 'towers ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D424")) Is Nothing Then 'rosh ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D426")) Is Nothing Then 'game time ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
        End If
    ElseIf MapNR = 4 Then
        If Tier > 1 Then
            If Not Intersect(Target, Range("D558:D570")) Is Nothing Then
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D572")) Is Nothing Then
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
        Else
            If Not Intersect(Target, Range("D560")) Is Nothing Then 'kills hcp
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D565")) Is Nothing Then 'kills ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D568")) Is Nothing Then 'towers ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D570")) Is Nothing Then 'rosh ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D572")) Is Nothing Then 'game time ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
        End If
    ElseIf MapNR = 5 Then
        If Tier > 1 Then
            If Not Intersect(Target, Range("D704:D716")) Is Nothing Then
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D718")) Is Nothing Then
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
        Else
            If Not Intersect(Target, Range("D706")) Is Nothing Then 'kills hcp
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D711")) Is Nothing Then 'kills ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D714")) Is Nothing Then 'towers ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D716")) Is Nothing Then 'rosh ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
            If Not Intersect(Target, Range("D718")) Is Nothing Then 'game time ou
                Set Index_Pos = Target
                Call GoToNextHCPLine
            End If
        End If
    End If
        
ElseIf Sheet5.Range("G3") = "KOG" Then
' kills hcp
    If Not Intersect(Target, Range("D156")) Is Nothing Then
        Set Index_Pos = Range("D156")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D302")) Is Nothing Then
        Set Index_Pos = Range("D302")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D448")) Is Nothing Then
        Set Index_Pos = Range("D448")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D594")) Is Nothing Then
        Set Index_Pos = Range("D594")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D740")) Is Nothing Then
        Set Index_Pos = Range("D740")
        Call GoToNextHCPLine
    End If
' kills ou
    If Not Intersect(Target, Range("D158")) Is Nothing Then
        Set Index_Pos = Range("D158")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D304")) Is Nothing Then
        Set Index_Pos = Range("D304")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D450")) Is Nothing Then
        Set Index_Pos = Range("D450")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D596")) Is Nothing Then
        Set Index_Pos = Range("D596")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D742")) Is Nothing Then
        Set Index_Pos = Range("D742")
        Call GoToNextHCPLine
    End If
' towers ou
    If Not Intersect(Target, Range("D159")) Is Nothing Then
        Set Index_Pos = Range("D159")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D305")) Is Nothing Then
        Set Index_Pos = Range("D305")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D451")) Is Nothing Then
        Set Index_Pos = Range("D451")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D597")) Is Nothing Then
        Set Index_Pos = Range("D597")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D743")) Is Nothing Then
        Set Index_Pos = Range("D743")
        Call GoToNextHCPLine
    End If
    
ElseIf Sheet5.Range("G3") = "R6" Then
'''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
' R6 RHCP
    If Not Intersect(Target, Range("D143")) Is Nothing Then
        Set Index_Pos = Range("D143")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D289")) Is Nothing Then
        Set Index_Pos = Range("D289")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D435")) Is Nothing Then
        Set Index_Pos = Range("D435")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D581")) Is Nothing Then
        Set Index_Pos = Range("D581")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D727")) Is Nothing Then
        Set Index_Pos = Range("D727")
        Call GoToNextHCPLine
    End If
    'next round
    If Not Intersect(Target, Range("E141")) Is Nothing Then
        Set Index_Pos = Range("E141")
        Call GoToNextIndexLine
    End If
    If Not Intersect(Target, Range("E287")) Is Nothing Then
        Set Index_Pos = Range("E287")
        Call GoToNextIndexLine
    End If
    If Not Intersect(Target, Range("E433")) Is Nothing Then
        Set Index_Pos = Range("E433")
        Call GoToNextIndexLine
    End If
    If Not Intersect(Target, Range("E579")) Is Nothing Then
        Set Index_Pos = Range("E579")
        Call GoToNextIndexLine
    End If
    If Not Intersect(Target, Range("E725")) Is Nothing Then
        Set Index_Pos = Range("E725")
        Call GoToNextIndexLine
    End If
ElseIf Sheet5.Range("G3") = "VAL" Then
'''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
' VAL RHCP
    If Not Intersect(Target, Range("D165")) Is Nothing Then
        Set Index_Pos = Range("D165")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D311")) Is Nothing Then
        Set Index_Pos = Range("D311")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D457")) Is Nothing Then
        Set Index_Pos = Range("D457")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D603")) Is Nothing Then
        Set Index_Pos = Range("D603")
        Call GoToNextHCPLine
    End If
    If Not Intersect(Target, Range("D749")) Is Nothing Then
        Set Index_Pos = Range("D749")
        Call GoToNextHCPLine
    End If
    
ElseIf Sheet5.Range("G3") = "COD" Then
'''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
' COD RHCP
'    If Not Intersect(Target, Range("D289")) Is Nothing Then 'Map 2
'        Set Index_Pos = Range("D289")
'        Call GoToNextHCPLine
'    End If
'    If Not Intersect(Target, Range("D727")) Is Nothing Then 'Map 5
'        Set Index_Pos = Range("D727")
'        Call GoToNextHCPLine
'    End If
End If

Application.CutCopyMode = False

'If R6 then keep MapNR, else Reset it
If Sheet7.[D12] = "R6" Or Sheet7.[D12] = "COD" Then
Else
    MapNR = 0
End If

End Sub

Private Sub CurrentMapSuspend_Click()

Dim LastRow As Integer
Dim Combo As Range

Application.ScreenUpdating = False

LastRow = Cells(rows.Count, 2).End(xlUp).Row

On Error GoTo Terminate
Set Combo = Range("a6", Cells(LastRow, 1)).SpecialCells(xlCellTypeConstants, 1)

        If CurrentMapSuspend.value = True Then
            With Combo
                .Offset(0, 2).value = "Suspended"
                .Offset(0, 2).Style = "Neutral"
            End With
            CurrentMapSuspend.BackColor = RGB(230, 230, 20)
            CurrentMapSuspend.Caption = "Trade"
        Else
            With Combo
                .Offset(0, 2).value = "Trading"
                .Offset(0, 2).Style = "Good"
            End With
            CurrentMapSuspend.BackColor = 13037518
            CurrentMapSuspend.Caption = "Suspend"
        End If
               
Terminate:
End Sub




