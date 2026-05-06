!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Name "IronGrid Agent"
OutFile "IronGridAgentSetup.exe"
InstallDir "C:\\IronGridAgent"
RequestExecutionLevel admin

; Variables
Var ServerIP
Var Dialog
Var Lbl1
Var ComboProtocol
Var Lbl2
Var TextIP
Var Lbl3
Var TextPort
Var SelectedProtocol
Var InputIP
Var InputPort

;--------------------------------
; Interface Settings
!define MUI_ABORTWARNING
!define MUI_ICON "assets\IronGrid.ico"
!define MUI_UNICON "assets\IronGrid.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP_NOSTRETCH

;--------------------------------
; Pages

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY

; Custom Page for Server IP
Page custom ServerPage ServerPageLeave

!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

;--------------------------------
; Languages
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "PortugueseBR"

;--------------------------------
; Custom Page Function
Function ServerPage
    !insertmacro MUI_HEADER_TEXT "Configuração do Servidor" "Defina o endereço do servidor IronGrid."
    nsDialogs::Create 1018
    Pop $Dialog

    ${If} $Dialog == error
        Abort
    ${EndIf}

    ; Protocolo
    ${NSD_CreateLabel} 0 0 25% 12u "Protocolo:"
    Pop $Lbl1
    
    ${NSD_CreateDropList} 0 15u 25% 40u "http"
    Pop $ComboProtocol
    SendMessage $ComboProtocol ${CB_ADDSTRING} 0 "STR:http"
    SendMessage $ComboProtocol ${CB_ADDSTRING} 0 "STR:https"
    SendMessage $ComboProtocol ${CB_SELECTSTRING} -1 "STR:http"

    ; IP ou Hostname
    ${NSD_CreateLabel} 30% 0 45% 12u "Servidor (IP / Hostname):"
    Pop $Lbl2

    ${NSD_CreateText} 30% 15u 45% 12u ""
    Pop $TextIP

    ; Porta
    ${NSD_CreateLabel} 80% 0 20% 12u "Porta:"
    Pop $Lbl3

    ${NSD_CreateText} 80% 15u 20% 12u "3001"
    Pop $TextPort
    
    nsDialogs::Show
FunctionEnd

Function ServerPageLeave
    ; Retreive texts from inputs
    ${NSD_GetText} $ComboProtocol $SelectedProtocol
    ${NSD_GetText} $TextIP $InputIP
    ${NSD_GetText} $TextPort $InputPort

    ; Verificação anti-vazio para IP
    ${If} $InputIP == ""
        MessageBox MB_ICONSTOP|MB_OK "O campo Servidor (IP / Hostname) eh obrigatorio! Nao pode estar vazio."
        Abort
    ${EndIf}

    ; Formatar URL Completa final
    StrCpy $ServerIP "$SelectedProtocol://$InputIP:$InputPort"
FunctionEnd

;--------------------------------
; Sections

Section "IronGrid Agent (Files)" SecAgent
    SectionIn RO ; Read only, mandatory
    
    SetOutPath "$INSTDIR"
    
    ; Stop and delete existing service to ensure files are not locked
    DetailPrint "Cleaning up old processes and services..."
    ExecWait 'taskkill /F /IM agent-win.exe /T'
    ExecWait 'taskkill /F /IM tvnserver.exe /T'
    ExecWait 'sc stop IronGridAgent'
    ExecWait 'sc delete IronGridAgent'
    Sleep 2000

    ; Main Agent Binary
    DetailPrint "Installing Agent Binaries..."
    File "/oname=IronGridAgent.exe" "dist\bin\agent-win.exe"
    
    ; VNC Server Binary (Required for Remote Access)
    SetOutPath "$INSTDIR\bin"
    File "/oname=tvnserver.exe" "..\server\public\agents\tvnserver.exe"

    ; Assets (Icons, etc)
    SetOutPath "$INSTDIR\assets"
    File "assets\IronGrid.ico"

    SetOutPath "$INSTDIR"

    ; Create config.json based on input
    DetailPrint "Configuring Agent..."
    ReadEnvStr $1 COMPUTERNAME
    FileOpen $0 "$INSTDIR\config.json" w
    FileWrite $0 "{"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "  $\"serverUrl$\": $\"$ServerIP$\","
    FileWrite $0 "$\r$\n"
    FileWrite $0 "  $\"agentId$\": $\"$1$\""
    FileWrite $0 "$\r$\n"
    FileWrite $0 "}"
    FileClose $0

SectionEnd

Section "Instalar Agente (Serviço, Firewall, SNMP)" SecService
    DetailPrint "Running internal agent installer..."
    ; Executa o instalador interno do agente que já lida corretamente com winsw.exe, firewall e SNMP
    ExecWait '"$INSTDIR\IronGridAgent.exe" --install --server=$ServerIP'
    
    ; Create Desktop Shortcut for easy access
    CreateShortCut "$DESKTOP\IronGrid Agent v4.0.1.lnk" "$INSTDIR\IronGridAgent.exe" "" "$INSTDIR\IronGridAgent.exe" 0
SectionEnd

; Descriptions
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecAgent} "Arquivos principais do Agente."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecService} "Configura os Servicos do Agente (SNMP, Firewall, Telemetria)."
!insertmacro MUI_FUNCTION_DESCRIPTION_END
