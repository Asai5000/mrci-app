frmMain ソースコード

Option Compare Database

'Main function, converts current state of form into MRCI score and updates header fields
'This function is called whenever any field is updated
Private Sub Form_OnClick()
    Dim patID As Integer
    Dim FreqCount As Integer
    Dim UnderCount As Integer
    
    If Not IsNull(Me.PatientID.Value) Then
        Me.MedcomA.Value = 0
        If Me.Form_Capsule.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 1
        If Me.Form_Gargle.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 2
        If Me.Form_Gums.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 2
        If Me.Form_Liquids.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 2
        If Me.Form_Powders.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 2
        If Me.Form_Sublingual.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 2
        If Me.Form_Creams.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 2
        'If Me.Form_Dressings.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 3
        If Me.Form_Paints.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 2
        If Me.Form_Pastes.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 3
        If Me.Form_Patches.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 2
        If Me.Form_Sprays.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 1
        If Me.Form_EarDrops.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 3
        If Me.Form_EyeDrops.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 3
        If Me.Form_EyeGels.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 3
        If Me.Form_NasalDrops.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 3
        If Me.Form_NasalSpray.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 2
        'If Me.Form_Accuhalers.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 3
        If Me.Form_Aerolizers.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 3
        If Me.Form_MeteredDose.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 4
        If Me.Form_Nebuliser.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 5
        If Me.Form_Oxygen.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 3
        'If Me.Form_Turbuhalers.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 3
        If Me.Form_OtherDPIs.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 3
       ' If Me.Form_Dialysate.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 5
        If Me.Form_Enemas.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 2
        If Me.Form_Inj_Prefilled.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 3
        If Me.Form_Inj_Ampoules.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 4
       ' If Me.Form_Pessaries.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 3
       ' If Me.Form_Analgesia.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 2
        If Me.Form_Suppositories.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 2
        If Me.Form_Vaginal.Value = True Then Me.MedcomA.Value = Me.MedcomA.Value + 2
        
    
        Me.MedcomB.Value = 0
        If Me.Freq_OnceDaily.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + Me.Freq_OnceDaily.Value
        If Me.Freq_OnceDailyPRN.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 0.5 * Me.Freq_OnceDailyPRN.Value
        If Me.Freq_TwiceDaily.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 2 * Me.Freq_TwiceDaily.Value
        If Me.Freq_TwiceDailyPRN.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + Me.Freq_TwiceDailyPRN.Value
        If Me.Freq_ThreeDaily.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 3 * Me.Freq_ThreeDaily.Value
        If Me.Freq_ThreeDailyPRN.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 1.5 * Me.Freq_ThreeDailyPRN.Value
        If Me.Freq_FourDaily.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 4 * Me.Freq_FourDaily.Value
        If Me.Freq_FourDailyPRN.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 2 * Me.Freq_FourDailyPRN.Value
        If Me.Freq_Q12H.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 2.5 * Me.Freq_Q12H.Value
        If Me.Freq_Q12HPRN.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 1.5 * Me.Freq_Q12HPRN.Value
        If Me.Freq_Q8H.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 3.5 * Me.Freq_Q8H.Value
        If Me.Freq_Q8HPRN.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 2 * Me.Freq_Q8HPRN.Value
        If Me.Freq_Q6H.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 4.5 * Me.Freq_Q6H.Value
        If Me.Freq_Q6HPRN.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 2.5 * Me.Freq_Q6HPRN.Value
        If Me.Freq_Q4H.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 6.5 * Me.Freq_Q4H.Value
        If Me.Freq_Q4HPRN.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 3.5 * Me.Freq_Q4HPRN.Value
        If Me.Freq_Q2H.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 12.5 * Me.Freq_Q2H.Value
        If Me.Freq_Q2HPRN.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 6.5 * Me.Freq_Q2HPRN.Value
        If Me.Freq_PRN.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 0.5 * Me.Freq_PRN.Value
        If Me.Freq_AlternateDays.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 2 * Me.Freq_AlternateDays.Value
        If Me.Freq_OxygenPRN.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + Me.Freq_OxygenPRN.Value
        If Me.Freq_OxygenLT15.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 2 * Me.Freq_OxygenLT15.Value
        If Me.Freq_OxygenGT15.Value > 0 Then Me.MedcomB.Value = Me.MedcomB.Value + 3 * Me.Freq_OxygenGT15.Value

        Me.MedcomC.Value = 0
        If Me.Directions_Break.Value > 0 Then Me.MedcomC.Value = Me.MedcomC.Value + Me.Directions_Break.Value
        If Me.Directions_Dissolve.Value > 0 Then Me.MedcomC.Value = Me.MedcomC.Value + Me.Directions_Dissolve.Value
        If Me.Directions_Multiple.Value > 0 Then Me.MedcomC.Value = Me.MedcomC.Value + Me.Directions_Multiple.Value
        If Me.Directions_Variable.Value > 0 Then Me.MedcomC.Value = Me.MedcomC.Value + Me.Directions_Variable.Value
        If Me.Directions_SpecifiedTime.Value > 0 Then Me.MedcomC.Value = Me.MedcomC.Value + Me.Directions_SpecifiedTime.Value
        If Me.Directions_Relation.Value > 0 Then Me.MedcomC.Value = Me.MedcomC.Value + Me.Directions_Relation.Value
        'If Me.Directions_Fluid.Value > 0 Then Me.MedcomC.Value = Me.MedcomC.Value + Me.Directions_Fluid.Value
        If Me.Directions_TakeUse.Value > 0 Then Me.MedcomC.Value = Me.MedcomC.Value + 2 * Me.Directions_TakeUse.Value
        If Me.Directions_Tapering.Value > 0 Then Me.MedcomC.Value = Me.MedcomC.Value + 2 * Me.Directions_Tapering.Value
        If Me.Directions_Alternating.Value > 0 Then Me.MedcomC.Value = Me.MedcomC.Value + 2 * Me.Directions_Alternating.Value
    
        Me.MedcomScore.Value = Me.MedcomA.Value + Me.MedcomB.Value + Me.MedcomC.Value
        
    
        patID = Me.PatientID.Value

        Me.Cohort.Value = "Other"
        If (1000 <= patID) And (patID < 1500) Then Me.Cohort.Value = "CU HTN"
        If (1500 <= patID) And (patID < 2000) Then Me.Cohort.Value = "UCSD HTN"
        If (2000 <= patID) And (patID < 2500) Then Me.Cohort.Value = "CU DBM"
        If (2500 <= patID) And (patID < 3000) Then Me.Cohort.Value = "UCSD DBM"
        If (3000 <= patID) And (patID < 3500) Then Me.Cohort.Value = "CU Geriatric Depression"
        If (3500 <= patID) And (patID < 4000) Then Me.Cohort.Value = "UCSD Geriatric Depression"
        If (4000 <= patID) And (patID < 4500) Then Me.Cohort.Value = "CU HIV"
        If (4500 <= patID) And (patID < 5000) Then Me.Cohort.Value = "UCSD HIV"
        
        Me.Dirty = False
    End If
End Sub




Private Sub PatientID_AfterUpdate()
    Dim rs As DAO.Recordset

    patID = Me.PatientID.Value
    oldpatID = Me.PatientID.OldValue
    Form_Type = Me.Form_Type.Value
    
    If Not IsNull(oldpatID) Then
        Me.PatientID.Value = oldpatID
    End If
    If Not IsNull(Me.PatientID.Value) And Me.Dirty Then
        Me.Dirty = False
    End If
    
    If IsNull(Me.MedCount.Value) And Not IsNull(oldpatID) Then
        MsgBox ("Please fill in the Medication Count before moving on from this record.")
    Else
        If Not IsNull(patID) Then
            'Search in the clone set.
            Set rs = Me.RecordsetClone
            rs.FindFirst "[PatientID] = " & patID & " AND [Form_Type] = '" & Form_Type & "'"
            If rs.NoMatch Then
                DoCmd.GoToRecord , , acNewRec
                Me.PatientID.Value = patID
            Me.Form_Type.Value = Form_Type
            Else
            'Display the found record in the form.
                Me.Bookmark = rs.Bookmark
            End If
        End If
        Set rs = Nothing
        Call Form_OnClick
    End If
End Sub


Private Sub Form_Type_AfterUpdate()
    Dim rs As DAO.Recordset
    Dim patID As Integer
    Dim Form_Type As String

    patID = Me.PatientID.Value
    Form_Type = Me.Form_Type.Value
    If Not IsNull(Me.Form_Type.OldValue) Then
        Me.Form_Type.Value = Me.Form_Type.OldValue
    End If
    
    If IsNull(Me.MedCount.Value) Then
        MsgBox ("Please fill in the Medication Count before moving on from this record.")
    Else
        If Me.Dirty Then
            Me.Dirty = False
        End If
 
        'Search in the clone set.
        Set rs = Me.RecordsetClone
        rs.FindFirst "[PatientID] = " & patID & " AND [Form_Type] = '" & Form_Type & "'"
        If rs.NoMatch Then
            DoCmd.GoToRecord , , acNewRec
            Me.PatientID.Value = patID
            Me.Form_Type.Value = Form_Type
        Else
            'Display the found record in the form.
            Me.Bookmark = rs.Bookmark
        End If
        Set rs = Nothing
        Call Form_OnClick
    End If
End Sub

Private Sub PatientID_Enter()
    Call PatientID_AfterUpdate
End Sub


Private Sub NextPatient_Click()
    Dim rs As DAO.Recordset

    If IsNull(Me.MedCount.Value) Then
        MsgBox ("Please fill in the Medication Count before moving on from this record.")
    Else
        patID = Me.PatientID.Value + 1
        'Save before move.
        If Me.Dirty Then
            Me.Dirty = False
        End If
        'Search in the clone set.
        Set rs = Me.RecordsetClone
        rs.FindFirst "[PatientID] = " & patID & " AND [Form_Type] = 'Disease Rx'"
        If rs.NoMatch Then
            DoCmd.GoToRecord , , acNewRec
            Me.PatientID.Value = patID
        Else
            'Display the found record in the form.
            Me.Bookmark = rs.Bookmark
        End If
        Set rs = Nothing
        Call Form_OnClick
    End If
End Sub



Private Sub PrevPatient_Click()
    Dim rs As DAO.Recordset

    If IsNull(Me.MedCount.Value) Then
        MsgBox ("Please fill in the Medication Count before moving on from this record.")
    Else
        patID = Me.PatientID.Value - 1
        If patID = 1000 Then patID = 1001
        'Save before move.
        If Me.Dirty Then
            Me.Dirty = False
        End If
        'Search in the clone set.
        Set rs = Me.RecordsetClone
        rs.FindFirst "[PatientID] = " & patID & " AND [Form_Type] = 'Disease Rx'"
        If rs.NoMatch Then
            DoCmd.GoToRecord , , acNewRec
            Me.PatientID.Value = patID
        Else
            'Display the found record in the form.
            Me.Bookmark = rs.Bookmark
        End If
        Set rs = Nothing
        Call Form_OnClick
    End If
End Sub

Private Sub NextFormType_Click()
    Dim rs As DAO.Recordset
    
    If IsNull(Me.MedCount.Value) Then
        MsgBox ("Please fill in the Medication Count before moving on from this record.")
    Else
        If Me.Form_Type.Value = "Disease Rx" Then FormType = "Other Rx"
        If Me.Form_Type.Value = "Other Rx" Then FormType = "OTC"
        If Me.Form_Type.Value = "OTC" Then FormType = "Disease Rx"
    
        patID = Me.PatientID.Value
        PDFID = Me.SourceID.Value
       
        'Save before move.
        If Me.Dirty Then
            Me.Dirty = False
        End If
        'Search in the clone set.
        Set rs = Me.RecordsetClone
        rs.FindFirst "[PatientID] = " & Me.PatientID.Value & " AND [Form_Type] = '" & FormType & "'"
        If rs.NoMatch Then
            DoCmd.GoToRecord , , acNewRec
            Me.PatientID.Value = patID
            Me.SourceID.Value = PDFID
            Me.Form_Type.Value = FormType
        Else
            'Display the found record in the form.
            Me.Bookmark = rs.Bookmark
        End If
        Set rs = Nothing
        Call Form_OnClick
    End If
End Sub

Private Sub PrevFormType_Click()
    Dim rs As DAO.Recordset
    
    If IsNull(Me.MedCount.Value) Then
        MsgBox ("Please fill in the Medication Count before moving on from this record.")
    Else
        If Me.Form_Type.Value = "Disease Rx" Then FormType = "OTC"
        If Me.Form_Type.Value = "Other Rx" Then FormType = "Disease Rx"
        If Me.Form_Type.Value = "OTC" Then FormType = "Other Rx"
    
        patID = Me.PatientID.Value
        SourceID = Me.SourceID.Value
        
        'Save before move.
        If Me.Dirty Then
            Me.Dirty = False
        End If
        'Search in the clone set.
        Set rs = Me.RecordsetClone
        rs.FindFirst "[PatientID] = " & Me.PatientID.Value & " AND [Form_Type] = '" & FormType & "'"
        If rs.NoMatch Then
            DoCmd.GoToRecord , , acNewRec
            Me.PatientID.Value = patID
            Me.SourceID.Value = SourceID
            Me.Form_Type.Value = FormType
        Else
            'Display the found record in the form.
            Me.Bookmark = rs.Bookmark
        End If
        Set rs = Nothing
        Call Form_OnClick
    End If
End Sub

Private Sub DeleteCurrent_Click()
    DoCmd.RunCommand acCmdSelectRecord
    LResponse = MsgBox("Are you sure you want to delete this record", vbYesNo, "Continue")
    If LResponse = vbYes Then
        DoCmd.RunCommand acCmdDeleteRecord
        DoCmd.GoToRecord , , acFirst
    End If
End Sub



' Buttons to open help sections
Private Sub HelpSection1_Click()
    DoCmd.OpenForm ("Section 1 - Help")
End Sub

Private Sub HelpSection2_Click()
    DoCmd.OpenForm ("Section 2 - Help")
End Sub

Private Sub HelpSection3_Click()
    DoCmd.OpenForm ("Section 3 - Help")
End Sub

Private Sub HelpCohortRanges_Click()
    DoCmd.OpenForm ("Cohort Ranges")
End Sub

Private Sub HelpSection4_Click()
    DoCmd.OpenForm ("Section 4 - Help")
End Sub


Private Sub HelpSourceID_Click()
    DoCmd.OpenForm ("Source ID - Help")
End Sub



' Included form automatically saves after each update
Private Sub BlankFreqs_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Directions_Alternating_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Directions_Break_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Directions_Dissolve_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Directions_Fluid_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Directions_Multiple_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Directions_Relation_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Directions_SpecifiedTime_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Directions_TakeUse_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Directions_Tapering_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Directions_Variable_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Form_Accuhalers_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Aerolizers_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Analgesia_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Capsule_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Creams_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Dialysate_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Dressings_Click()
    Call Form_OnClick
End Sub

Private Sub Form_EarDrops_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Enemas_Click()
    Call Form_OnClick
End Sub

Private Sub Form_EyeDrops_Click()
    Call Form_OnClick
End Sub

Private Sub Form_EyeGels_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Gargle_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Gums_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Inj_Ampoules_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Inj_Prefilled_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Liquids_Click()
    Call Form_OnClick
End Sub

Private Sub Form_MeteredDose_Click()
    Call Form_OnClick
End Sub

Private Sub Form_NasalDrops_Click()
    Call Form_OnClick
End Sub

Private Sub Form_NasalSpray_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Nebuliser_Click()
    Call Form_OnClick
End Sub

Private Sub Form_OtherDPIs_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Oxygen_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Paints_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Pastes_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Patches_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Pessaries_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Powders_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Sprays_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Sublingual_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Suppositories_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Turbuhalers_Click()
    Call Form_OnClick
End Sub

Private Sub Form_Vaginal_Click()
    Call Form_OnClick
End Sub

Private Sub Freq_AlternateDays_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_FourDaily_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_FourDailyPRN_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_OnceDaily_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_OnceDailyPRN_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_OxygenGT15_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_OxygenLT15_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_OxygenPRN_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_PRN_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_Q12H_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_Q12HPRN_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_Q2H_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_Q2HPRN_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_Q4H_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_Q4HPRN_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_Q6H_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_Q6HPRN_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_Q8H_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_Q8HPRN_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_ThreeDaily_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_ThreeDailyPRN_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_TwiceDaily_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub Freq_TwiceDailyPRN_AfterUpdate()
    Call Form_OnClick
End Sub

Private Sub MedCount_AfterUpdate()
    Call Form_OnClick
End Sub


' Code for Plus/Minus buttons for each entry field
Private Sub Minus_1_Click()
    If IsNull(Me.Freq_OnceDaily.Value) Then Freq_OnceDaily.Value = 0
    Me.Freq_OnceDaily.Value = Me.Freq_OnceDaily.Value - 1
    If Me.Freq_OnceDaily.Value < 0 Then Freq_OnceDaily.Value = 0
    Call Form_OnClick
End Sub


Private Sub Plus_1_Click()
    If IsNull(Me.Freq_OnceDaily.Value) Then Freq_OnceDaily.Value = 0
    Me.Freq_OnceDaily.Value = Me.Freq_OnceDaily.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_2_Click()
    If IsNull(Me.Freq_OnceDailyPRN.Value) Then Freq_OnceDailyPRN.Value = 0
    Me.Freq_OnceDailyPRN.Value = Me.Freq_OnceDailyPRN.Value - 1
    If Me.Freq_OnceDailyPRN.Value < 0 Then Freq_OnceDailyPRN.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_2_Click()
    If IsNull(Me.Freq_OnceDailyPRN.Value) Then Freq_OnceDailyPRN.Value = 0
    Me.Freq_OnceDailyPRN.Value = Me.Freq_OnceDailyPRN.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_3_Click()
    If IsNull(Me.Freq_TwiceDaily.Value) Then Freq_TwiceDaily.Value = 0
    Me.Freq_TwiceDaily.Value = Me.Freq_TwiceDaily.Value - 1
    If Me.Freq_TwiceDaily.Value < 0 Then Freq_TwiceDaily.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_3_Click()
    If IsNull(Me.Freq_TwiceDaily.Value) Then Freq_TwiceDaily.Value = 0
    Me.Freq_TwiceDaily.Value = Me.Freq_TwiceDaily.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_4_Click()
    If IsNull(Me.Freq_TwiceDailyPRN.Value) Then Freq_TwiceDailyPRN.Value = 0
    Me.Freq_TwiceDailyPRN.Value = Me.Freq_TwiceDailyPRN.Value - 1
    If Me.Freq_TwiceDailyPRN.Value < 0 Then Freq_TwiceDailyPRN.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_4_Click()
    If IsNull(Me.Freq_TwiceDailyPRN.Value) Then Freq_TwiceDailyPRN.Value = 0
    Me.Freq_TwiceDailyPRN.Value = Me.Freq_TwiceDailyPRN.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_5_Click()
    If IsNull(Me.Freq_ThreeDaily.Value) Then Freq_ThreeDaily.Value = 0
    Me.Freq_ThreeDaily.Value = Me.Freq_ThreeDaily.Value - 1
    If Me.Freq_ThreeDaily.Value < 0 Then Freq_ThreeDaily.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_5_Click()
    If IsNull(Me.Freq_ThreeDaily.Value) Then Freq_ThreeDaily.Value = 0
    Me.Freq_ThreeDaily.Value = Me.Freq_ThreeDaily.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_6_Click()
    If IsNull(Me.Freq_ThreeDailyPRN.Value) Then Freq_ThreeDailyPRN.Value = 0
    Me.Freq_ThreeDailyPRN.Value = Me.Freq_ThreeDailyPRN.Value - 1
    If Me.Freq_ThreeDailyPRN.Value < 0 Then Freq_ThreeDailyPRN.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_6_Click()
    If IsNull(Me.Freq_ThreeDailyPRN.Value) Then Freq_ThreeDailyPRN.Value = 0
    Me.Freq_ThreeDailyPRN.Value = Me.Freq_ThreeDailyPRN.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_7_Click()
    If IsNull(Me.Freq_FourDaily.Value) Then Freq_FourDaily.Value = 0
    Me.Freq_FourDaily.Value = Me.Freq_FourDaily.Value - 1
    If Me.Freq_FourDaily.Value < 0 Then Freq_FourDaily.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_7_Click()
    If IsNull(Me.Freq_FourDaily.Value) Then Freq_FourDaily.Value = 0
    Me.Freq_FourDaily.Value = Me.Freq_FourDaily.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_8_Click()
    If IsNull(Me.Freq_FourDailyPRN.Value) Then Freq_FourDailyPRN.Value = 0
    Me.Freq_FourDailyPRN.Value = Me.Freq_FourDailyPRN.Value - 1
    If Me.Freq_FourDailyPRN.Value < 0 Then Freq_FourDailyPRN.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_8_Click()
    If IsNull(Me.Freq_FourDailyPRN.Value) Then Freq_FourDailyPRN.Value = 0
    Me.Freq_FourDailyPRN.Value = Me.Freq_FourDailyPRN.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_9_Click()
    If IsNull(Me.Freq_Q12H.Value) Then Freq_Q12H.Value = 0
    Me.Freq_Q12H.Value = Me.Freq_Q12H.Value - 1
    If Me.Freq_Q12H.Value < 0 Then Freq_Q12H.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_9_Click()
    If IsNull(Me.Freq_Q12H.Value) Then Freq_Q12H.Value = 0
    Me.Freq_Q12H.Value = Me.Freq_Q12H.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_10_Click()
    If IsNull(Me.Freq_Q12HPRN.Value) Then Freq_Q12HPRN.Value = 0
    Me.Freq_Q12HPRN.Value = Me.Freq_Q12HPRN.Value - 1
    If Me.Freq_Q12HPRN.Value < 0 Then Freq_Q12HPRN.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_10_Click()
    If IsNull(Me.Freq_Q12HPRN.Value) Then Freq_Q12HPRN.Value = 0
    Me.Freq_Q12HPRN.Value = Me.Freq_Q12HPRN.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_11_Click()
    If IsNull(Me.Freq_Q8H.Value) Then Freq_Q8H.Value = 0
    Me.Freq_Q8H.Value = Me.Freq_Q8H.Value - 1
    If Me.Freq_Q8H.Value < 0 Then Freq_Q8H.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_11_Click()
    If IsNull(Me.Freq_Q8H.Value) Then Freq_Q8H.Value = 0
    Me.Freq_Q8H.Value = Me.Freq_Q8H.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_12_Click()
    If IsNull(Me.Freq_Q8HPRN.Value) Then Freq_Q8HPRN.Value = 0
    Me.Freq_Q8HPRN.Value = Me.Freq_Q8HPRN.Value - 1
    If Me.Freq_Q8HPRN.Value < 0 Then Freq_Q8HPRN.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_12_Click()
    If IsNull(Me.Freq_Q8HPRN.Value) Then Freq_Q8HPRN.Value = 0
    Me.Freq_Q8HPRN.Value = Me.Freq_Q8HPRN.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_13_Click()
    If IsNull(Me.Freq_Q6H.Value) Then Freq_Q6H.Value = 0
    Me.Freq_Q6H.Value = Me.Freq_Q6H.Value - 1
    If Me.Freq_Q6H.Value < 0 Then Freq_Q6H.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_13_Click()
    If IsNull(Me.Freq_Q6H.Value) Then Freq_Q6H.Value = 0
    Me.Freq_Q6H.Value = Me.Freq_Q6H.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_14_Click()
    If IsNull(Me.Freq_Q6HPRN.Value) Then Freq_Q6HPRN.Value = 0
    Me.Freq_Q6HPRN.Value = Me.Freq_Q6HPRN.Value - 1
    If Me.Freq_Q6HPRN.Value < 0 Then Freq_Q6HPRN.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_14_Click()
    If IsNull(Me.Freq_Q6HPRN.Value) Then Freq_Q6HPRN.Value = 0
    Me.Freq_Q6HPRN.Value = Me.Freq_Q6HPRN.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_15_Click()
    If IsNull(Me.Freq_Q4H.Value) Then Freq_Q4H.Value = 0
    Me.Freq_Q4H.Value = Me.Freq_Q4H.Value - 1
    If Me.Freq_Q4H.Value < 0 Then Freq_Q4H.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_15_Click()
    If IsNull(Me.Freq_Q4H.Value) Then Freq_Q4H.Value = 0
    Me.Freq_Q4H.Value = Me.Freq_Q4H.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_16_Click()
    If IsNull(Me.Freq_Q4HPRN.Value) Then Freq_Q4HPRN.Value = 0
    Me.Freq_Q4HPRN.Value = Me.Freq_Q4HPRN.Value - 1
    If Me.Freq_Q4HPRN.Value < 0 Then Freq_Q4HPRN.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_16_Click()
    If IsNull(Me.Freq_Q4HPRN.Value) Then Freq_Q4HPRN.Value = 0
    Me.Freq_Q4HPRN.Value = Me.Freq_Q4HPRN.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_17_Click()
    If IsNull(Me.Freq_Q2H.Value) Then Freq_Q2H.Value = 0
    Me.Freq_Q2H.Value = Me.Freq_Q2H.Value - 1
    If Me.Freq_Q2H.Value < 0 Then Freq_Q2H.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_17_Click()
    If IsNull(Me.Freq_Q2H.Value) Then Freq_Q2H.Value = 0
    Me.Freq_Q2H.Value = Me.Freq_Q2H.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_18_Click()
    If IsNull(Me.Freq_Q2HPRN.Value) Then Freq_Q2HPRN.Value = 0
    Me.Freq_Q2HPRN.Value = Me.Freq_Q2HPRN.Value - 1
    If Me.Freq_Q2HPRN.Value < 0 Then Freq_Q2HPRN.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_18_Click()
    If IsNull(Me.Freq_Q2HPRN.Value) Then Freq_Q2HPRN.Value = 0
    Me.Freq_Q2HPRN.Value = Me.Freq_Q2HPRN.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_19_Click()
    If IsNull(Me.Freq_PRN.Value) Then Freq_PRN.Value = 0
    Me.Freq_PRN.Value = Me.Freq_PRN.Value - 1
    If Me.Freq_PRN.Value < 0 Then Freq_PRN.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_19_Click()
    If IsNull(Me.Freq_PRN.Value) Then Freq_PRN.Value = 0
    Me.Freq_PRN.Value = Me.Freq_PRN.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_20_Click()
    If IsNull(Me.Freq_AlternateDays.Value) Then Freq_AlternateDays.Value = 0
    Me.Freq_AlternateDays.Value = Me.Freq_AlternateDays.Value - 1
    If Me.Freq_AlternateDays.Value < 0 Then Freq_AlternateDays.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_20_Click()
    If IsNull(Me.Freq_AlternateDays.Value) Then Freq_AlternateDays.Value = 0
    Me.Freq_AlternateDays.Value = Me.Freq_AlternateDays.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_21_Click()
    If IsNull(Me.Freq_OxygenPRN.Value) Then Freq_OxygenPRN.Value = 0
    Me.Freq_OxygenPRN.Value = Me.Freq_OxygenPRN.Value - 1
    If Me.Freq_OxygenPRN.Value < 0 Then Freq_OxygenPRN.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_21_Click()
    If IsNull(Me.Freq_OxygenPRN.Value) Then Freq_OxygenPRN.Value = 0
    Me.Freq_OxygenPRN.Value = Me.Freq_OxygenPRN.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_22_Click()
    If IsNull(Me.Freq_OxygenLT15.Value) Then Freq_OxygenLT15.Value = 0
    Me.Freq_OxygenLT15.Value = Me.Freq_OxygenLT15.Value - 1
    If Me.Freq_OxygenLT15.Value < 0 Then Freq_OxygenLT15.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_22_Click()
    If IsNull(Me.Freq_OxygenLT15.Value) Then Freq_OxygenLT15.Value = 0
    Me.Freq_OxygenLT15.Value = Me.Freq_OxygenLT15.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_23_Click()
    If IsNull(Me.Freq_OxygenGT15.Value) Then Freq_OxygenGT15.Value = 0
    Me.Freq_OxygenGT15.Value = Me.Freq_OxygenGT15.Value - 1
    If Me.Freq_OxygenGT15.Value < 0 Then Freq_OxygenGT15.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_23_Click()
    If IsNull(Me.Freq_OxygenGT15.Value) Then Freq_OxygenGT15.Value = 0
    Me.Freq_OxygenGT15.Value = Me.Freq_OxygenGT15.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_24_Click()
    If IsNull(Me.Directions_Break.Value) Then Directions_Break.Value = 0
    Me.Directions_Break.Value = Me.Directions_Break.Value - 1
    If Me.Directions_Break.Value < 0 Then Directions_Break.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_24_Click()
    If IsNull(Me.Directions_Break.Value) Then Directions_Break.Value = 0
    Me.Directions_Break.Value = Me.Directions_Break.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_25_Click()
    If IsNull(Me.Directions_Dissolve.Value) Then Directions_Dissolve.Value = 0
    Me.Directions_Dissolve.Value = Me.Directions_Dissolve.Value - 1
    If Me.Directions_Dissolve.Value < 0 Then Directions_Dissolve.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_25_Click()
    If IsNull(Me.Directions_Dissolve.Value) Then Directions_Dissolve.Value = 0
    Me.Directions_Dissolve.Value = Me.Directions_Dissolve.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_26_Click()
    If IsNull(Me.Directions_Multiple.Value) Then Directions_Multiple.Value = 0
    Me.Directions_Multiple.Value = Me.Directions_Multiple.Value - 1
    If Me.Directions_Multiple.Value < 0 Then Directions_Multiple.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_26_Click()
    If IsNull(Me.Directions_Multiple.Value) Then Directions_Multiple.Value = 0
    Me.Directions_Multiple.Value = Me.Directions_Multiple.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_27_Click()
    If IsNull(Me.Directions_Variable.Value) Then Directions_Variable.Value = 0
    Me.Directions_Variable.Value = Me.Directions_Variable.Value - 1
    If Me.Directions_Variable.Value < 0 Then Directions_Variable.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_27_Click()
    If IsNull(Me.Directions_Variable.Value) Then Directions_Variable.Value = 0
    Me.Directions_Variable.Value = Me.Directions_Variable.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_28_Click()
    If IsNull(Me.Directions_SpecifiedTime.Value) Then Directions_SpecifiedTime.Value = 0
    Me.Directions_SpecifiedTime.Value = Me.Directions_SpecifiedTime.Value - 1
    If Me.Directions_SpecifiedTime.Value < 0 Then Directions_SpecifiedTime.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_28_Click()
    If IsNull(Me.Directions_SpecifiedTime.Value) Then Directions_SpecifiedTime.Value = 0
    Me.Directions_SpecifiedTime.Value = Me.Directions_SpecifiedTime.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_29_Click()
    If IsNull(Me.Directions_Relation.Value) Then Directions_Relation.Value = 0
    Me.Directions_Relation.Value = Me.Directions_Relation.Value - 1
    If Me.Directions_Relation.Value < 0 Then Directions_Relation.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_29_Click()
    If IsNull(Me.Directions_Relation.Value) Then Directions_Relation.Value = 0
    Me.Directions_Relation.Value = Me.Directions_Relation.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_30_Click()
    If IsNull(Me.Directions_Fluid.Value) Then Directions_Fluid.Value = 0
    Me.Directions_Fluid.Value = Me.Directions_Fluid.Value - 1
    If Me.Directions_Fluid.Value < 0 Then Directions_Fluid.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_30_Click()
    If IsNull(Me.Directions_Fluid.Value) Then Directions_Fluid.Value = 0
    Me.Directions_Fluid.Value = Me.Directions_Fluid.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_31_Click()
    If IsNull(Me.Directions_TakeUse.Value) Then Directions_TakeUse.Value = 0
    Me.Directions_TakeUse.Value = Me.Directions_TakeUse.Value - 1
    If Me.Directions_TakeUse.Value < 0 Then Directions_TakeUse.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_31_Click()
    If IsNull(Me.Directions_TakeUse.Value) Then Directions_TakeUse.Value = 0
    Me.Directions_TakeUse.Value = Me.Directions_TakeUse.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_32_Click()
    If IsNull(Me.Directions_Tapering.Value) Then Directions_Tapering.Value = 0
    Me.Directions_Tapering.Value = Me.Directions_Tapering.Value - 1
    If Me.Directions_Tapering.Value < 0 Then Directions_Tapering.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_32_Click()
    If IsNull(Me.Directions_Tapering.Value) Then Directions_Tapering.Value = 0
    Me.Directions_Tapering.Value = Me.Directions_Tapering.Value + 1
    Call Form_OnClick
End Sub

Private Sub Minus_33_Click()
    If IsNull(Me.Directions_Alternating.Value) Then Directions_Alternating.Value = 0
    Me.Directions_Alternating.Value = Me.Directions_Alternating.Value - 1
    If Me.Directions_Alternating.Value < 0 Then Directions_Alternating.Value = 0
    Call Form_OnClick
End Sub

Private Sub Plus_33_Click()
    If IsNull(Me.Directions_Alternating.Value) Then Directions_Alternating.Value = 0
    Me.Directions_Alternating.Value = Me.Directions_Alternating.Value + 1
    Call Form_OnClick
End Sub
