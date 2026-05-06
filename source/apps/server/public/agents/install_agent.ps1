<#
Use o comando abaixo para baixar e executar este script com parâmetros:

$script = (New-Object System.Net.WebClient).DownloadString('http://192.168.0.121:3001/downloads/install_agent.ps1')
$sb = [ScriptBlock]::Create($script)
& $sb -ServerIP '192.168.0.121' -Community 'IronGrid'

Ou use variáveis de ambiente:

$env:IRONGRID_SERVERIP='192.168.0.121'
$env:IRONGRID_COMMUNITY='IronGrid'
iex ((New-Object System.Net.WebClient).DownloadString('http://192.168.0.121:3001/downloads/install_agent.ps1'))
#>

param (
    [string]$ServerIP = "localhost",
    [string]$Community = "IronGrid",
    [switch]$InstallAgent = $true
)

# Perguntar apenas se não vier parâmetro
if (-not $PSBoundParameters.ContainsKey('ServerIP') -or [string]::IsNullOrWhiteSpace($ServerIP)) {
    if ($env:IRONGRID_SERVERIP) {
        $ServerIP = $env:IRONGRID_SERVERIP
    } else {
        $ServerIP = Read-Host "Digite o IP ou hostname do servidor"
    }
}

if (-not $PSBoundParameters.ContainsKey('Community') -or [string]::IsNullOrWhiteSpace($Community)) {
    if ($env:IRONGRID_COMMUNITY) {
        $Community = $env:IRONGRID_COMMUNITY
    } else {
        $Community = Read-Host "Digite a comunidade SNMP (Enter = IronGrid)"
        if ([string]::IsNullOrWhiteSpace($Community)) {
            $Community = "IronGrid"
        }
    }
}

function Validate-ServerIP($serverIp) {
    if ([string]::IsNullOrWhiteSpace($serverIp)) { return $false }
    try {
        [Uri]::new("http://$serverIp:3001/") | Out-Null
        return $true
    } catch {
        return $false
    }
}

if (-not (Validate-ServerIP $ServerIP)) {
    Write-ErrorMsg "Servidor inválido: '$ServerIP'. Use um endereço IP ou hostname real do servidor IronGrid, sem caracteres de espaço ou reticências."
    exit 1
}

$ErrorActionPreference = "Stop"

function Write-Info($msg) {
    Write-Host "[IronGrid] $msg" -ForegroundColor Cyan
}

function Write-Success($msg) {
    Write-Host "[IronGrid] OK: $msg" -ForegroundColor Green
}

function Write-WarningMsg($msg) {
    Write-Host "[IronGrid] WARN: $msg" -ForegroundColor Yellow
}

function Write-ErrorMsg($msg) {
    Write-Host "[IronGrid] ERROR: $msg" -ForegroundColor Red
}

# 1. Verification of Admin privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (!$currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-ErrorMsg "Este script precisa ser executado como ADMINISTRADOR."
    exit 1
}

Write-Info "Iniciando configuracao do SNMP para IronGrid..."
Write-Info "Servidor: $ServerIP"
Write-Info "Comunidade: $Community"

# 2. Install SNMP Feature
try {
    Write-Info "Verificando recurso SNMP..."
    $snmpClient = Get-WindowsCapability -Online -Name "SNMP.Client~~~~0.0.1.0"
    
    if ($snmpClient.State -ne 'Installed') {
        Write-Info "Instalando recurso SNMP (isso pode demorar alguns minutos)..."
        Add-WindowsCapability -Online -Name "SNMP.Client~~~~0.0.1.0"
        Write-Success "Recurso SNMP instalado com sucesso."
    } else {
        Write-Success "Recurso SNMP ja esta instalado."
    }
} catch {
    Write-ErrorMsg "Falha ao instalar SNMP: $($_.Exception.Message)"
    Write-WarningMsg "Tente habilitar manualmente via 'Ativar ou Desativar Recursos do Windows'."
}

# 3. Configure SNMP Service Registry
try {
    Write-Info "Configurando registros do SNMP..."
    $baseKey = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters"
    
    # Community
    $commKey = "$baseKey\ValidCommunities"
    if (!(Test-Path $commKey)) { New-Item -Path $commKey -Force | Out-Null }
    Set-ItemProperty -Path $commKey -Name $Community -Value 4  # 4 = READ ONLY
    
    # Permitted Managers
    $permKey = "$baseKey\PermittedManagers"
    if (!(Test-Path $permKey)) { New-Item -Path $permKey -Force | Out-Null }
    # Clear existing managers to ensure our server is priority or add it as "1"
    Set-ItemProperty -Path $permKey -Name "1" -Value $ServerIP
    
    Write-Success "Registros SNMP configurados."
} catch {
    Write-ErrorMsg "Erro ao configurar registros: $($_.Exception.Message)"
}

# 4. Restart SNMP Service
try {
    Write-Info "Reiniciando servico SNMP..."
    Restart-Service -Name "SNMP" -Force
    Set-Service -Name "SNMP" -StartupType Automatic
    Write-Success "Servico SNMP ativo e configurado para inicio automatico."
} catch {
    Write-WarningMsg "Nao foi possivel reiniciar o servico SNMP. Verifique manualmente."
}

# 5. Optional: Install IronGrid Agent
if ($InstallAgent) {
    Write-Info "Iniciando instalacao do Agente IronGrid completo..."
    $workDir = "$env:TEMP\IronGrid"
    if (!(Test-Path $workDir)) { New-Item -Path $workDir -ItemType Directory | Out-Null }
    
    $exeUrl = "http://$($ServerIP):3001/downloads/IronGridAgentSetup.exe"
    $exePath = "$workDir\IronGridAgentSetup.exe"
    
    try {
        Write-Info "Baixando instalador de $exeUrl ..."
        Invoke-WebRequest -Uri $exeUrl -OutFile $exePath
        
        Write-Info "Executando instalador..."
        Start-Process -FilePath $exePath -ArgumentList "/S", "--server=http://$($ServerIP):3001" -Wait
        
        # Configure Agent config.json 
        # (Assuming default install path, adjust if installer.nsi changed it)
        $installPath = "C:\IronGridAgent"
        if (Test-Path $installPath) {
            $configFile = "$installPath\config.json"
            $configObj = @{
                serverUrl = "http://$($ServerIP):3001"
                agentId = $env:COMPUTERNAME
            }
            $configObj | ConvertTo-Json | Out-File $configFile -Encoding UTF8
            Write-Success "Agente configurado com sucesso."
            
            # Restart service if exists
            if (Get-Service -Name "IronGridAgent" -ErrorAction SilentlyContinue) {
                Restart-Service -Name "IronGridAgent" -Force
            }
        }
        
    } catch {
        Write-ErrorMsg "Erro ao baixar ou instalar o agente: $($_.Exception.Message)"
    }
}

Write-Success "Configuracao finalizada com sucesso."
Write-Info "Pressione qualquer tecla para sair..."
$null = [Console]::ReadKey()
