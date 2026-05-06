import si from 'systeminformation';
import { Logger } from './utils/logger';

/**
 * Interface que define a estrutura de métricas de sistema coletadas pelo agente.
 */
export interface SystemMetrics {
    cpu: {
        load: number;    // Carga atual da CPU em porcentagem
        cores: number[]; // Carga individual de cada núcleo (core)
        model?: string;  // Modelo da CPU
        speed?: number;  // Velocidade da CPU (GHz)
    };
    memory: {
        total: number;   // Memória total em bytes
        used: number;    // Memória ativa em bytes
        free: number;    // Memória disponível em bytes
        percent: number; // Porcentagem de uso
        slots?: number;  // Quantidade de slots de memória
    };
    disk: Array<{
        fs: string;          // Nome do sistema de arquivos
        size: number;        // Tamanho total em bytes
        used: number;        // Espaço usado em bytes
        usePercent: number;  // Porcentagem de uso do disco
        mount: string;       // Ponto de montagem (ex: C: ou /)
    }>;
    network: Array<{
        iface: string;     // Nome da interface de rede
        rx_bytes: number;  // Bytes recebidos
        tx_bytes: number;  // Bytes enviados
        operstate: string; // Estado operacional (up/down)
    }>;
    uptime: number;    // Tempo de atividade do sistema em segundos
    timestamp: Date;   // Momento da coleta
    security?: {
        av: string;        // Nome do Antivírus detectado
        avStatus: string;  // Status (Ativo/Inativo)
        usbBlocked: boolean; // Se portas de armazenamento estão bloqueadas
    };
    patches?: Array<{
        id: string;        // ID da KB
        description: string;
        date: string;
    }>;
    activity?: {
        currentWindow: string; // Janela em foco no momento
        stats: Record<string, number>; // Tempo acumulado por app (em segundos)
    };
}

export interface HardwareFallback {
    cpuName: string;
    cpuSpeed: number;
    totalMem: number;
}

/**
 * Auxiliar para executar comandos PowerShell complexos via Base64 para evitar erros de escape.
 */
async function runPowerShell(script: string): Promise<string> {
    try {
        const buffer = Buffer.from(script, 'utf16le');
        const base64 = buffer.toString('base64');
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand ${base64}`, {
            windowsHide: true
        });
        return stdout;
    } catch (e: any) {
        Logger.error(`[Collector] Erro PowerShell: ${e.message}`);
        return '';
    }
}

/**
 * Auxiliar para obter status de segurança (Windows Only)
 */
async function getSecurityInfo() {
    if (process.platform !== 'win32') return undefined;
    try {
        // Verifica se a classe existe antes de tentar consultar (evita erro em Windows Server)
        const checkClass = 'if (Get-CimClass -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction SilentlyContinue) { $true } else { $false }';
        const classExists = (await runPowerShell(checkClass)).trim().toLowerCase() === 'true';
        
        if (!classExists) {
            return { av: 'N/A (Server OS)', avStatus: 'Proteção via Painel Server' };
        }

        const psCmd = 'Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct | Select-Object displayName, productState | ConvertTo-Json';
        const stdout = await runPowerShell(psCmd);
        if (!stdout.trim()) return { av: 'Windows Defender', avStatus: 'Ativo' };
        
        const av = JSON.parse(stdout);
        const data = Array.isArray(av) ? av[0] : av;
        
        const state = parseInt(data.productState);
        const isOutdated = (state & 0x1000) !== 0; 
        const isActive = (state.toString(16).startsWith('26') || state.toString(16).startsWith('3e'));

        let statusStr = isActive ? 'Ativo' : 'Inativo';
        if (isActive && isOutdated) statusStr = 'Ativo (Desatualizado)';
        
        return {
            av: data.displayName,
            avStatus: statusStr
        };
    } catch (e) { 
        return { av: 'Desconhecido', avStatus: 'Erro' }; 
    }
}


async function getRecentPatches() {
    if (process.platform !== 'win32') return [];
    try {
        const psCmd = 'Get-HotFix | Select-Object HotFixID, Description, InstalledOn -First 10 | ConvertTo-Json';
        const stdout = await runPowerShell(psCmd);
        if (!stdout.trim()) return [];
        const parsed = JSON.parse(stdout);
        const array = Array.isArray(parsed) ? parsed : [parsed];
        return array.map((p: any) => ({
            id: p.HotFixID,
            description: p.Description,
            date: p.InstalledOn ? new Date(p.InstalledOn).toISOString() : 'N/A'
        }));
    } catch (e) { return []; }
}

/**
 * Coleta informações básicas de hardware como fallback caso o systeminformation falhe.
 */
export async function getHardwareFallback(): Promise<HardwareFallback> {
    const defaultRes = { cpuName: 'Desconhecido', cpuSpeed: 0, totalMem: 0 };
    if (process.platform !== 'win32') return defaultRes;

    try {
        const psHw = `
            $cpu = Get-CimInstance Win32_Processor | Select-Object Name, MaxClockSpeed -First 1
            $mem = Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum
            [PSCustomObject]@{
                CpuName = $cpu.Name
                CpuSpeed = $cpu.MaxClockSpeed
                TotalMem = $mem.Sum
            } | ConvertTo-Json
        `;
        const stdout = await runPowerShell(psHw);
        if (stdout.trim()) {
            const hw = JSON.parse(stdout);
            return {
                cpuName: hw.CpuName || 'Desconhecido',
                cpuSpeed: (hw.CpuSpeed || 0) / 1000,
                totalMem: hw.TotalMem || 0
            };
        }
    } catch (hwE) {}
    return defaultRes;
}

/**
 * Coleta métricas vitais do sistema operacional utilizando a biblioteca systeminformation.
 */
export async function getSystemMetrics(activityStats: Record<string, number> = {}): Promise<SystemMetrics> {
    const cpuLoad = await si.currentLoad();
    const mem = await si.mem();
    const fsSize = await si.fsSize();
    const cpuInfo = await si.cpu();
    
    // Fallback Manual para Hardware se o sensor principal falhar
    const hw = await getHardwareFallback();
    
    let cpuModel = cpuInfo.brand || hw.cpuName;
    let cpuSpeed = cpuInfo.speed || hw.cpuSpeed;
    let totalMem = mem.total || hw.totalMem;

    // Solicita estatísticas de rede para todas as interfaces ('*')
    const networkStats = await si.networkStats('*');

    return {
        cpu: {
            load: cpuLoad.currentLoad,
            cores: cpuLoad.cpus.map((c) => c.load),
            model: cpuModel, // Adicionado para o InventoryService
            speed: cpuSpeed
        },
        memory: {
            total: totalMem,
            used: mem.active,
            free: mem.available,
            percent: (mem.active / (totalMem || 1)) * 100,
            slots: (mem as any).slots || 0
        },
        disk: fsSize.map(fs => {
            // Correção defensiva de unidade: se o tamanho for > 1GB mas o usado for muito baixo (< 10KB), 
            // pode indicar erro de escala do plugin do sistema.
            let used = fs.used;
            if (fs.size > 1024 * 1024 * 1024 && fs.used < 10000 && fs.used > 0) {
                used = Math.round(fs.used * 1024 * 1024 * 1024);
            }
            return {
                fs: fs.fs,
                size: fs.size,
                used: used,
                usePercent: (used / (fs.size || 1)) * 100,
                mount: fs.mount
            };
        }),
        network: await (async () => {
            // Mapeia estatísticas básicas obtidas pelo systeminformation
            const stats = networkStats.map(net => ({
                iface: net.iface,
                rx_bytes: net.rx_bytes || 0,
                tx_bytes: net.tx_bytes || 0,
                operstate: net.operstate || 'unknown'
            }));

            // Tratamento especial para Windows: usa PowerShell para obter contadores de bytes mais precisos
            // quando a biblioteca padrão falha em reportar tráfego.
            if (process.platform === 'win32') {
                try {
                    const psCommand = 'Get-NetAdapter | ForEach-Object { $s = $_ | Get-NetAdapterStatistics; [PSCustomObject]@{ Name=$_.Name; Desc=$_.InterfaceDescription; In=$s.ReceivedBytes; Out=$s.SentBytes } } | ConvertTo-Json';
                    const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -WindowStyle Hidden -Command "${psCommand}"`, { windowsHide: true });
                    if (stdout.trim()) {
                        const parsed = JSON.parse(stdout);
                        const array = Array.isArray(parsed) ? parsed : [parsed];
                        array.forEach((p: any) => {
                            const match = stats.find(s => s.iface === p.Name || s.iface === p.Desc);
                            if (match) {
                                // Apenas atualiza se o valor atual for zero (complementando falha da lib principal)
                                if (match.rx_bytes === 0) match.rx_bytes = p.In || 0;
                                if (match.tx_bytes === 0) match.tx_bytes = p.Out || 0;
                            } else {
                                stats.push({ iface: p.Desc || p.Name, rx_bytes: p.In || 0, tx_bytes: p.Out || 0, operstate: 'up' });
                            }
                        });
                    }
                } catch (e) { console.error('[Collector] Falha no PowerShell:', e); }
            }
            return stats;
        })(),
        uptime: si.time().uptime,
        timestamp: new Date(),
        security: {
            ...(await getSecurityInfo() || { av: 'N/A', avStatus: 'N/A' }),
            usbBlocked: false
        },
        patches: await getRecentPatches(),
        activity: {
            currentWindow: Object.keys(activityStats).pop() || 'Idle',
            stats: activityStats
        }
    };
}

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Obtém a lista de softwares instalados no sistema operacional.
 * Suporta Windows (via WMIC) e Linux (via DPKG).
 */
export async function getInstalledSoftware(): Promise<any[]> {
    try {
        if (process.platform === 'win32') {
            /** 
             * Turbo-Inventory: Varredura via Registro PowerShell
             * Ignora atualizações e componentes de sistema sem nome amigável.
             */
            const psCmd = `
                $keys = @(
                    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
                    "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
                    "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
                )
                $apps = Get-ItemProperty $keys -ErrorAction SilentlyContinue | 
                        Where-Object { $_.DisplayName -ne $null } | 
                        Select-Object DisplayName, DisplayVersion, Publisher, InstallDate
                
                @($apps) | ConvertTo-Json -Compress
            `;
            
            const stdout = await runPowerShell(psCmd);
            if (!stdout.trim() || stdout === '[]') {
                Logger.info('[Collector] Nenhum software encontrado via Registro.');
                return [];
            }
            
            const apps = JSON.parse(stdout);
            const array = Array.isArray(apps) ? apps : [apps];
            
            Logger.info(`[Collector] Softwares encontrados: ${array.length}`);

            return array.map((a: any) => ({
                name: String(a.DisplayName).substring(0, 255),
                version: String(a.DisplayVersion || 'N/A').substring(0, 50),
                publisher: String(a.Publisher || '').substring(0, 255),
                installDate: a.InstallDate || ''
            }));
        } else if (process.platform === 'linux') {
            const { stdout } = await execAsync("dpkg-query -W -f='${Package}|${Version}|${Maintainer}\n'");
            return stdout.split('\n').filter(l => l.trim()).map(line => {
                const [name, version, publisher] = line.split('|');
                return { name, version, publisher, installDate: '' };
            });
        }
        return [];
    } catch (e) {
        console.error('Erro ao buscar lista de softwares:', e);
        return [];
    }
}
