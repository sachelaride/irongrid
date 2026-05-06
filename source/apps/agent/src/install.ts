import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';
import readline from 'readline';

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

function askQuestion(query: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

export async function uninstallAgent() {
    const isWindows = process.platform === 'win32';
    const targetDir = isWindows ? 'C:\\IronGridAgent' : '/opt/irongrid-agent';
    const daemonDir = path.join(targetDir, 'daemon');
    const serviceName = 'IronGridAgent';
    const wrapperPath = path.join(daemonDir, `${serviceName}.exe`);

    console.log('[Uninstall] Starting cleanup...');

    if (isWindows) {
        // 0. Kill any hanging processes
        console.log('[Uninstall] Killing hanging processes if any...');
        try { execSync(`taskkill /F /FI "PID ne ${process.pid}" /IM IronGridAgent.exe /T`, { stdio: 'pipe' }); } catch (e) { }
        try { execSync('taskkill /F /IM agent-win.exe /T', { stdio: 'pipe' }); } catch (e) { }
        await sleep(500);

        if (fs.existsSync(wrapperPath)) {
            console.log('[Uninstall] Stopping and uninstalling service via wrapper...');
            try { execSync(`"${wrapperPath}" stop`, { stdio: 'pipe' }); } catch (e) { }
            try { execSync(`"${wrapperPath}" uninstall`, { stdio: 'pipe' }); } catch (e) { }
            await sleep(2000);
        }

        console.log('[Uninstall] Forcing cleanup via sc delete (legacy service removal)...');
        try { execSync(`sc stop ${serviceName}`, { stdio: 'pipe' }); } catch (e) { }
        try { execSync(`sc delete ${serviceName}`, { stdio: 'pipe' }); } catch (e) { }

        console.log('[Uninstall] Removing Registry Run keys...');
        try { execSync(`reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "IronGridAgent" /f`, { stdio: 'pipe' }); } catch (e) { }
        try { execSync(`reg delete "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "IronGridAgent" /f`, { stdio: 'pipe' }); } catch (e) { }

        // Loop to wait until the service is actually gone or we timeout
        let isPresent = true;
        for (let i = 0; i < 5; i++) {
            try {
                execSync(`sc query ${serviceName}`, { stdio: 'pipe' });
                console.log(`[Uninstall] Legacy Service still present, waiting... (${i + 1}/5)`);
                await sleep(2000);
            } catch (e) {
                isPresent = false;
                break;
            }
        }

        if (isPresent) {
            console.warn('[Uninstall] WARNING: Service is still "marked for deletion".');
        } else {
            console.log('[Uninstall] Cleanup successfully finished.');
        }

        await sleep(1000);
    } else {
        console.log('[Uninstall] Removing systemd service...');
        try {
            execSync('systemctl stop irongrid-agent');
            execSync('systemctl disable irongrid-agent');
            if (fs.existsSync('/etc/systemd/system/irongrid-agent.service')) {
                fs.unlinkSync('/etc/systemd/system/irongrid-agent.service');
                execSync('systemctl daemon-reload');
            }
        } catch (e) { }
    }
}

export async function installAgent(serverUrl?: string) {
    const isWindows = process.platform === 'win32';
    const targetDir = isWindows ? 'C:\\IronGridAgent' : '/opt/irongrid-agent';
    const exeName = isWindows ? 'agent-win.exe' : 'agent-linux';
    const targetExe = path.join(targetDir, exeName);
    const configPath = path.join(targetDir, 'config.json');

    console.log(`[Install] Starting installation to ${targetDir}...`);

    try {
        // 0. Cleanup first
        await uninstallAgent();

        // 1. Create directory
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // 3. Create or Update config.json (Moved up to be available for SNMP logic)
        const currentConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
        const config = {
            serverUrl: serverUrl || currentConfig.serverUrl || 'http://localhost:3001',
            agentId: os.hostname()
        };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`[Install] Configuration updated with server: ${config.serverUrl}`);

        // 2. Copy current executable
        const currentExe = process.execPath;
        const isPackaged = (process as any).pkg !== undefined;

        if (!isPackaged && (currentExe.toLowerCase().includes('node') || currentExe.toLowerCase().includes('tsx'))) {
            console.warn('[Install] Running in dev mode (node/tsx). Skipping executable copy.');
        } else {
            fs.copyFileSync(currentExe, targetExe);
            console.log(`[Install] Copied executable to ${targetExe}`);

            // 2.1 Configure Firewall (Windows Only)
            if (isWindows) {
                console.log('[Install] Configuring Windows Firewall rules...');
                try {
                    // Allow ICMP (Ping) so the scanner can find us
                    execSync('netsh advfirewall firewall add rule name="IronGrid Agent - ICMP" protocol=icmpv4:8,any dir=in action=allow', { stdio: 'pipe' });
                    // Allow the agent executable
                    execSync(`netsh advfirewall firewall add rule name="IronGrid Agent - App" dir=in action=allow program="${targetExe}" enable=yes`, { stdio: 'pipe' });
                    // Allow SNMP (UDP 161)
                    execSync('netsh advfirewall firewall add rule name="IronGrid Agent - SNMP" protocol=UDP dir=in localport=161 action=allow profile=any', { stdio: 'pipe' });
                    console.log('[Install] Firewall rules configured.');
                } catch (fwErr: any) {
                    console.log(`[Install] Note: Firewall rule already exists or error: ${fwErr.message}`);
                }

                        const snmpAnswer = await askQuestion('\n[Install] Deseja instalar e configurar o Protocolo SNMP do Windows automaticamente agora? (S/n): ');
                        if (snmpAnswer.trim().toLowerCase() !== 'n') {
                            console.log('[Install] Verificando Windows SNMP Service...');
                            try {
                                // 1. Tenta instalar caso não exista (Isso exige privilégios de Admin e às vezes internet)
                                console.log('[Install] Ativando recurso SNMP no Windows (Aguarde)...');
                                const installCmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Add-WindowsCapability -Online -Name SNMP.Client~~~~0.0.1.0"';
                                execSync(installCmd, { stdio: 'inherit' });

                                // 2. Configura Comunidade 'IronGrid' (4 = READ ONLY)
                                console.log('[Install] Configurando comunidade SNMP: IronGrid');
                                execSync('reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\SNMP\\Parameters\\ValidCommunities" /v IronGrid /t REG_DWORD /d 4 /f', { stdio: 'pipe' });
                                
                                // 3. REMOVE restrições de Managers para garantir que o Servidor consiga descobrir o agente
                                console.log('[Install] Liberando SNMP para qualquer host (Modo Descoberta)...');
                                try {
                                    execSync('reg delete "HKLM\\SYSTEM\\CurrentControlSet\\Services\\SNMP\\Parameters\\PermittedManagers" /f', { stdio: 'pipe' });
                                    execSync('reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\SNMP\\Parameters\\PermittedManagers" /v 1 /t REG_SZ /d localhost /f', { stdio: 'pipe' });
                                    execSync('reg delete "HKLM\\SYSTEM\\CurrentControlSet\\Services\\SNMP\\Parameters\\PermittedManagers" /v 1 /f', { stdio: 'pipe' });
                                } catch(e) { }

                                // 4. Abre o Firewall para SNMP (UDP 161)
                                console.log('[Install] Abrindo porta UDP 161 no Firewall...');
                                try { 
                                    execSync('netsh advfirewall firewall delete rule name="IronGrid - SNMP"', { stdio: 'pipe' });
                                    execSync('netsh advfirewall firewall add rule name="IronGrid - SNMP" protocol=UDP dir=in localport=161 action=allow profile=any', { stdio: 'pipe' }); 
                                } catch(err) {}
                                
                                // 5. Garante que o serviço está no modo Automático e Reinicia
                                console.log('[Install] Reiniciando serviço SNMP...');
                                try { 
                                    execSync('sc config SNMP start= auto', { stdio: 'pipe' });
                                    execSync('powershell.exe -NoProfile -Command "Restart-Service SNMP -ErrorAction SilentlyContinue"', { stdio: 'pipe' }); 
                                } catch(e) {}
                                
                                console.log('\n[Install] SNMP configurado com sucesso! Comunidade: IronGrid');
                            } catch (snmpErr: any) {
                                console.log(`\n[Install] Nao foi possivel completar a instalacao automatica do SNMP: ${snmpErr.message}`);
                            }
                        } else {
                            console.log(`\n[Install] Instalacao do SNMP ignorada pelo usuario.`);
                    }
                }
            }

        // 4. Register Autostart / Service
        if (isWindows) {
            console.log('[Install] Installing Windows service support and user tray autostart...');
            const serviceName = 'IronGridAgent';
            const daemonDir = path.join(targetDir, 'daemon');
            const wrapperPath = path.join(daemonDir, `${serviceName}.exe`);
            const xmlPath = path.join(daemonDir, `${serviceName}.xml`);
            let serviceCreated = false;

            try {
                if (!fs.existsSync(daemonDir)) {
                    fs.mkdirSync(daemonDir, { recursive: true });
                }

                let sourceWinsw = '';
                try {
                    sourceWinsw = path.join(path.dirname(require.resolve('node-windows')), '..', 'bin', 'winsw', 'winsw.exe');
                } catch (resolveErr) {
                    sourceWinsw = path.resolve(__dirname, '..', '..', '..', 'node_modules', 'node-windows', 'bin', 'winsw', 'winsw.exe');
                }

                if (fs.existsSync(sourceWinsw)) {
                    fs.copyFileSync(sourceWinsw, wrapperPath);
                    console.log(`[Install] Extracted service wrapper: ${wrapperPath}`);

                    const xmlContent = `
<service>
  <id>${serviceName}</id>
  <name>IronGrid Monitor Agent</name>
  <description>IronGrid Agent Service</description>
  <executable>${targetExe}</executable>
  <workingdirectory>${targetDir}</workingdirectory>
  <startmode>Automatic</startmode>
  <log mode="roll"></log>
</service>`.trim();

                    fs.writeFileSync(xmlPath, xmlContent);
                    console.log(`[Install] Generated service config: ${xmlPath}`);

                    try {
                        execSync(`"${wrapperPath}" install`, { stdio: 'inherit' });
                        console.log('[Install] Service installed using winsw wrapper.');
                        serviceCreated = true;
                    } catch (installErr: any) {
                        console.warn('[Install] winsw install failed:', installErr.message);
                    }
                }

                if (!serviceCreated) {
                    try {
                        console.log('[Install] Creating service using sc create fallback...');
                        execSync(`sc create ${serviceName} binPath= "${targetExe}" DisplayName= "IronGrid Monitor Agent" start= auto`, { stdio: 'inherit' });
                        serviceCreated = true;
                    } catch (scErr: any) {
                        console.warn('[Install] sc create failed:', scErr.message);
                    }
                }

                if (serviceCreated) {
                    try {
                        execSync(`sc config ${serviceName} start= auto`, { stdio: 'inherit' });
                        execSync(`sc start ${serviceName}`, { stdio: 'inherit' });
                        console.log('[Install] Windows Service registered and started.');
                    } catch (startErr: any) {
                        console.error(`[Install] Failed to start service: ${startErr.message}`);
                    }
                }
            } catch (err: any) {
                console.error(`[Install] Service registration failed: ${err.message}`);
            }

            try {
                const runKey = '"HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"';
                const valueName = '"IronGridAgentUI"';
                execSync(`reg add ${runKey} /v ${valueName} /t REG_SZ /d "\"${targetExe}\" --tray" /f`, { stdio: 'inherit' });
                console.log('[Install] Global autostart registered for Tray UI (Session 1+).');

                try {
                    const { spawn } = require('child_process');
                    const child = spawn(targetExe, ['--tray'], {
                        detached: true,
                        stdio: 'ignore',
                        windowsHide: true
                    });
                    child.unref();
                    console.log('[Install] Agent Tray UI launched for current session.');
                } catch (runErr: any) {
                    console.warn('[Install] Failed to launch tray UI immediately:', runErr.message);
                }
            } catch (uiErr: any) {
                console.warn('[Install] Failed to register tray UI autostart:', uiErr.message);
            }
        } else {
            console.log('[Install] Registering Systemd Service...');
            const serviceFile = `[Unit]
Description=IronGrid Monitor Agent
After=network.target

[Service]
Type=simple
ExecStart=${targetExe}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target`;

            const unitPath = '/etc/systemd/system/irongrid-agent.service';
            try {
                fs.writeFileSync(unitPath, serviceFile);
                execSync('systemctl daemon-reload');
                execSync('systemctl enable irongrid-agent');
                execSync('systemctl start irongrid-agent');
                console.log('[Install] Systemd service registered and started.');
            } catch (err: any) {
                console.error(`[Install] Failed to register Systemd Service: ${err.message}`);
                console.log('[Install] Tip: Run with sudo to register services.');
            }
        }

        console.log('[Install] Installation complete!');
    } catch (error: any) {
        console.error(`[Install] FATAL ERROR: ${error.message}`);
    }

    await askQuestion('\n[Install] Concluido. Pressione ENTER para sair do instalador...');
}
