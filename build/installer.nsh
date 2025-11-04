!macro preInit
  ; Aggressively kill all related processes before installation
  DetailPrint "Closing Claude Browser and related processes..."

  ; Kill ALL instances multiple times with delays between each
  nsExec::Exec 'taskkill /F /IM "Claude Browser.exe" /T'
  Sleep 500
  nsExec::Exec 'taskkill /F /IM "Claude Browser.exe" /T'
  Sleep 500
  nsExec::Exec 'taskkill /F /IM "Claude Browser.exe" /T'
  Sleep 1000

  ; Kill all Electron and related processes
  nsExec::Exec 'taskkill /F /FI "IMAGENAME eq electron.exe" /T'
  nsExec::Exec 'taskkill /F /IM chrome.exe /T'
  nsExec::Exec 'taskkill /F /IM node.exe /T'
  Sleep 1000

  ; Delete lock files
  Delete "$LOCALAPPDATA\Claude Browser\*lock*"
  Delete "$APPDATA\Claude Browser\*lock*"
  Delete "$LOCALAPPDATA\claude-browser\*lock*"
  Delete "$APPDATA\claude-browser\*lock*"

  ; Try to delete the old installation directory forcefully
  DetailPrint "Removing old installation files..."
  RMDir /r /REBOOTOK "$INSTDIR"
  RMDir /r /REBOOTOK "$LOCALAPPDATA\Programs\claude-browser"
  RMDir /r /REBOOTOK "$LOCALAPPDATA\Programs\Claude Browser"

  ; Wait longer for file handles to fully release
  Sleep 5000
!macroend

!macro customInstall
  ; Kill processes during installation
  DetailPrint "Ensuring all processes remain closed..."
  nsExec::Exec 'taskkill /F /IM "Claude Browser.exe" /T'
  nsExec::Exec 'taskkill /F /IM chrome.exe /T'
  nsExec::Exec 'taskkill /F /IM node.exe /T'
  Sleep 2000
!macroend

!macro customUnInit
  ; Kill processes before uninstall
  DetailPrint "Closing Claude Browser before uninstall..."
  nsExec::Exec 'taskkill /F /IM "Claude Browser.exe" /T'
  nsExec::Exec 'taskkill /F /IM "Claude Browser.exe" /T'
  Sleep 500
  nsExec::Exec 'taskkill /F /IM chrome.exe /T'
  nsExec::Exec 'taskkill /F /IM node.exe /T'
  nsExec::Exec 'taskkill /F /IM electron.exe /T'
  Sleep 3000
!macroend
