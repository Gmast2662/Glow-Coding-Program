; ─── Glow IDE — Custom NSIS Installer Script ──────────────────────────────────
; This file is included by electron-builder's NSIS template.
; It adds:
;   • Welcome page with Glow branding
;   • Sketchbook folder selection page
;   • Options page: PATH, desktop shortcut, start menu shortcut
;   • Writes glow-preferences.json after install

!include "MUI2.nsh"
!include "LogicLib.nsh"

; ─── Variables ────────────────────────────────────────────────────────────────
Var SketchbookDir
Var AddToPath
Var AddDesktop
Var AddStartMenu

; ─── Pages ────────────────────────────────────────────────────────────────────

; Custom sketchbook page
Page custom SketchbookPageCreate SketchbookPageLeave

; Custom options page
Page custom OptionsPageCreate OptionsPageLeave

; ─── Sketchbook Page ──────────────────────────────────────────────────────────
Function SketchbookPageCreate
  ; Default sketchbook path
  StrCpy $SketchbookDir "C:\Glow-Sketchbook"

  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateLabel} 0 0 100% 20u "Sketchbook Folder"
  Pop $0
  CreateFont $1 "Segoe UI" 11 700
  SendMessage $0 ${WM_SETFONT} $1 1

  ${NSD_CreateLabel} 0 26u 100% 20u "Choose where Glow will save your sketches (code files)."
  Pop $0

  ${NSD_CreateDirRequest} 0 52u 78% 14u $SketchbookDir
  Pop $1
  GetFunctionAddress $2 OnSketchbookDirChange
  nsDialogs::OnChange $1 $2

  ${NSD_CreateBrowseButton} 80% 52u 20% 14u "Browse..."
  Pop $2
  GetFunctionAddress $3 OnBrowseSketchbook
  nsDialogs::OnClick $2 $3

  ${NSD_CreateLabel} 0 72u 100% 30u "This folder will be created automatically. You can change it later in Glow's preferences."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function OnSketchbookDirChange
  Pop $0
  ${NSD_GetText} $0 $SketchbookDir
FunctionEnd

Function OnBrowseSketchbook
  Pop $0
  nsDialogs::SelectFolderDialog "Select Sketchbook Folder" $SketchbookDir
  Pop $0
  ${If} $0 != "error"
    StrCpy $SketchbookDir $0
    ${NSD_SetText} $1 $SketchbookDir
  ${EndIf}
FunctionEnd

Function SketchbookPageLeave
  ${If} $SketchbookDir == ""
    StrCpy $SketchbookDir "C:\Glow-Sketchbook"
  ${EndIf}
FunctionEnd

; ─── Options Page ─────────────────────────────────────────────────────────────
Function OptionsPageCreate
  ; Defaults
  StrCpy $AddToPath    "1"
  StrCpy $AddDesktop   "1"
  StrCpy $AddStartMenu "1"

  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateLabel} 0 0 100% 20u "Install Options"
  Pop $0
  CreateFont $1 "Segoe UI" 11 700
  SendMessage $0 ${WM_SETFONT} $1 1

  ${NSD_CreateCheckbox} 0 28u 100% 12u "Add Glow to PATH (lets you run 'glow' from any terminal)"
  Pop $2
  ${NSD_SetState} $2 ${BST_CHECKED}
  GetFunctionAddress $3 OnPathToggle
  nsDialogs::OnClick $2 $3

  ${NSD_CreateCheckbox} 0 46u 100% 12u "Create Desktop shortcut"
  Pop $4
  ${NSD_SetState} $4 ${BST_CHECKED}
  GetFunctionAddress $5 OnDesktopToggle
  nsDialogs::OnClick $4 $5

  ${NSD_CreateCheckbox} 0 64u 100% 12u "Create Start Menu shortcut"
  Pop $6
  ${NSD_SetState} $6 ${BST_CHECKED}
  GetFunctionAddress $7 OnStartMenuToggle
  nsDialogs::OnClick $6 $7

  nsDialogs::Show
FunctionEnd

Function OnPathToggle
  Pop $0
  ${NSD_GetState} $0 $AddToPath
  ${If} $AddToPath == ${BST_CHECKED}
    StrCpy $AddToPath "1"
  ${Else}
    StrCpy $AddToPath "0"
  ${EndIf}
FunctionEnd

Function OnDesktopToggle
  Pop $0
  ${NSD_GetState} $0 $AddDesktop
  ${If} $AddDesktop == ${BST_CHECKED}
    StrCpy $AddDesktop "1"
  ${Else}
    StrCpy $AddDesktop "0"
  ${EndIf}
FunctionEnd

Function OnStartMenuToggle
  Pop $0
  ${NSD_GetState} $0 $AddStartMenu
  ${If} $AddStartMenu == ${BST_CHECKED}
    StrCpy $AddStartMenu "1"
  ${Else}
    StrCpy $AddStartMenu "0"
  ${EndIf}
FunctionEnd

Function OptionsPageLeave
FunctionEnd

; ─── Post-Install ─────────────────────────────────────────────────────────────
; Called by electron-builder after files are copied
!macro customInstall
  ; Create sketchbook folder
  CreateDirectory "$SketchbookDir"

  ; Write glow-preferences.json next to the executable
  FileOpen $0 "$INSTDIR\glow-preferences.json" w
  FileWrite $0 '{$\n'
  FileWrite $0 '  "version": 1,$\n'
  FileWrite $0 '  "sketchbookPath": "$SketchbookDir",$\n'
  FileWrite $0 '  "recentFiles": [],$\n'
  FileWrite $0 '  "theme": "dark",$\n'
  FileWrite $0 '  "autocomplete": true,$\n'
  FileWrite $0 '  "liveErrors": true,$\n'
  FileWrite $0 '  "autoClosePairs": true$\n'
  FileWrite $0 '}$\n'
  FileClose $0

  ; Add to PATH if requested
  ${If} $AddToPath == "1"
    EnVar::SetHKCU
    EnVar::AddValue "PATH" "$INSTDIR"
  ${EndIf}

  ; Desktop shortcut
  ${If} $AddDesktop == "1"
    CreateShortCut "$DESKTOP\Glow.lnk" "$INSTDIR\Glow.exe" "" "$INSTDIR\Glow.exe" 0
  ${EndIf}

  ; Start Menu shortcut
  ${If} $AddStartMenu == "1"
    CreateDirectory "$SMPROGRAMS\Glow"
    CreateShortCut "$SMPROGRAMS\Glow\Glow IDE.lnk" "$INSTDIR\Glow.exe" "" "$INSTDIR\Glow.exe" 0
    CreateShortCut "$SMPROGRAMS\Glow\Uninstall Glow.lnk" "$INSTDIR\Uninstall Glow.exe"
  ${EndIf}
!macroend

!macro customUnInstall
  ; Remove shortcuts on uninstall
  Delete "$DESKTOP\Glow.lnk"
  Delete "$SMPROGRAMS\Glow\Glow IDE.lnk"
  Delete "$SMPROGRAMS\Glow\Uninstall Glow.lnk"
  RMDir  "$SMPROGRAMS\Glow"

  ; Remove from PATH
  EnVar::SetHKCU
  EnVar::DeleteValue "PATH" "$INSTDIR"
!macroend
