; Custom NSIS uninstall guard for FastLauncher.
;
; !!! IMPORTANT !!!
; electron-builder inserts `customUnInstall` at the very END of the uninstall
; section — i.e. AFTER its own `RMDir /r "$INSTDIR"`. A guard there would be
; useless. `customUnInit` runs in `un.onInit`, before the uninstall section and
; before any file is touched, so the check lives here.
;
; The uninstaller is also launched silently by the installer during an update
; ("install old version -> install new version"). In that case it MUST exit
; with code 0, otherwise electron-builder aborts the whole update with
; "Uninstall failed" (see handleUninstallResult in installUtil.nsh).
!include "FileFunc.nsh"

; This private marker prevents a damaged uninstall registry entry from aiming
; electron-builder's recursive removal at an unrelated directory.
!macro customInstall
  FileOpen $0 "$INSTDIR\.fastlauncher-root" w
  FileWrite $0 "FastLauncher installation root"
  FileClose $0
!macroend

!macro customUnInit
  ; Only ever uninstall the exact FastLauncher folder with our marker,
  ; executable and app.asar. If anything is off we delete nothing at all.
  StrCmp $INSTDIR "" fastlauncher_skip_uninstall
  StrLen $0 $INSTDIR
  IntCmp $0 3 fastlauncher_skip_uninstall
  ${GetFileName} "$INSTDIR" $1
  StrCmp $1 "FastLauncher" 0 fastlauncher_skip_uninstall
  IfFileExists "$INSTDIR\.fastlauncher-root" 0 fastlauncher_skip_uninstall
  IfFileExists "$INSTDIR\FastLauncher.exe" 0 fastlauncher_skip_uninstall
  IfFileExists "$INSTDIR\resources\app.asar" fastlauncher_do_uninstall fastlauncher_skip_uninstall

  fastlauncher_skip_uninstall:
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONSTOP "FastLauncher installation markers were not found in:$\r$\n$INSTDIR$\r$\n$\r$\nNothing was deleted."
    ${EndIf}
    SetErrorLevel 0
    Quit

  fastlauncher_do_uninstall:
!macroend
