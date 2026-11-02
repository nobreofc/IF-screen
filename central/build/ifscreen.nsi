; IF Screen Central — instalador Windows (NSIS 3, Unicode)
; Gerar: makensis build/ifscreen.nsi   (depois de "electron-builder --win --x64")

Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!define APPNAME "IF Screen Central"
!define EXENAME "IF Screen Central.exe"
!define VERSION "1.1.0"
!define PUBLISHER "Projeto IF Screen - IFRN"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\IFScreenCentral"

Name "${APPNAME}"
OutFile "..\dist\IF-Screen-Central-Setup-${VERSION}.exe"
InstallDir "$PROGRAMFILES64\${APPNAME}"
InstallDirRegKey HKLM "Software\IFScreenCentral" "InstallDir"
RequestExecutionLevel admin
BrandingText "IF Screen - IFRN"

VIProductVersion "1.1.0.0"
VIAddVersionKey /LANG=1046 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=1046 "CompanyName" "${PUBLISHER}"
VIAddVersionKey /LANG=1046 "FileDescription" "Instalador do ${APPNAME}"
VIAddVersionKey /LANG=1046 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1046 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1046 "LegalCopyright" "${PUBLISHER}"

!include "MUI2.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"

!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_ABORTWARNING
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "header.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "header.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "wizard.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "wizard.bmp"
!define MUI_WELCOMEPAGE_TITLE "Instalação do IF Screen Central"
!define MUI_WELCOMEPAGE_TEXT "A Central recebe e organiza o tempo de tela coletado pelo aplicativo IF Screen nos celulares Android do estudo.$\r$\n$\r$\nO instalador também libera no Firewall do Windows as portas usadas pelos celulares na rede local (TCP 8787 e UDP 8788).$\r$\n$\r$\nClique em Avançar para continuar."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir o IF Screen Central agora"
!define MUI_UNCONFIRMPAGE_TEXT_TOP "O programa será removido. Os dados do estudo (pasta %APPDATA%\IF Screen Central) serão mantidos."

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

!macro FirewallRemove
  nsExec::Exec 'netsh advfirewall firewall delete rule name="IF Screen Central"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="IF Screen Central - dados (TCP 8787)"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="IF Screen Central - descoberta (UDP 8788)"'
!macroend

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "O IF Screen Central requer Windows 10 ou 11 de 64 bits."
    Abort
  ${EndIf}
  SetRegView 64
FunctionEnd

Function un.onInit
  SetRegView 64
FunctionEnd

Section "IF Screen Central" SecMain
  SectionIn RO
  SetShellVarContext all
  nsExec::Exec 'taskkill /F /IM "${EXENAME}"'
  Sleep 800
  SetOutPath "$INSTDIR"
  File /r "..\dist\win-unpacked\*.*"

  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
  CreateShortCut "$SMPROGRAMS\${APPNAME}\Desinstalar ${APPNAME}.lnk" "$INSTDIR\Desinstalar.exe"
  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0

  ; Firewall do Windows: celulares na mesma rede (modo in loco)
  !insertmacro FirewallRemove
  nsExec::Exec 'netsh advfirewall firewall add rule name="IF Screen Central" dir=in action=allow program="$INSTDIR\${EXENAME}" enable=yes profile=any'
  nsExec::Exec 'netsh advfirewall firewall add rule name="IF Screen Central - dados (TCP 8787)" dir=in action=allow protocol=TCP localport=8787 profile=any'
  nsExec::Exec 'netsh advfirewall firewall add rule name="IF Screen Central - descoberta (UDP 8788)" dir=in action=allow protocol=UDP localport=8788 profile=any'

  WriteUninstaller "$INSTDIR\Desinstalar.exe"
  WriteRegStr HKLM "Software\IFScreenCentral" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "${UNINSTKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKLM "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "${UNINSTKEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKLM "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\${EXENAME}"
  WriteRegStr HKLM "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${UNINSTKEY}" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegDWORD HKLM "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINSTKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "${UNINSTKEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  SetShellVarContext all
  nsExec::Exec 'taskkill /F /IM "${EXENAME}"'
  Sleep 800
  !insertmacro FirewallRemove
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKLM "${UNINSTKEY}"
  DeleteRegKey HKLM "Software\IFScreenCentral"
SectionEnd
