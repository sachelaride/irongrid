import fs from 'fs';
import path from 'path';
import os from 'os';

interface Config {
    serverUrl: string;
    agentId: string;
    metricsInterval?: number;
    inventoryInterval?: number;
}

// In packaged mode (pkg), execPath is the path to the exe. 
// In dev mode, it's the path to node/tsx.
const isPackaged = (process as any).pkg !== undefined;
const baseDir = isPackaged ? path.dirname(process.execPath) : process.cwd();
const CONFIG_FILE = path.join(baseDir, 'config.json');

const defaultConfig: Config = {
    serverUrl: 'http://127.0.0.1:3001',
    agentId: os.hostname(),
};

export function loadConfig(): Config {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            const parsed = JSON.parse(data);
            
            // Validação de segurança: se o ID for literal do instalador, vazio ou genérico (ex: ENTERPRISE), usa hostname real
            const genericIds = ['ENTERPRISE', 'irongrid', 'unigran', '{agentId}', 'DESKTOP', 'HOSTNAME'];
            if (!parsed.agentId || 
                parsed.agentId.startsWith('$') || 
                parsed.agentId === '{agentId}' || 
                genericIds.includes(parsed.agentId.toUpperCase()) ||
                parsed.agentId.length < 3) {
                parsed.agentId = defaultConfig.agentId;
            }

            if (!parsed.serverUrl || typeof parsed.serverUrl !== 'string' || parsed.serverUrl.trim() === '') {
                parsed.serverUrl = defaultConfig.serverUrl;
            }

            // Correção de URL malformada (ex: http:/ em vez de http://)
            if (parsed.serverUrl && parsed.serverUrl.startsWith('http:/') && !parsed.serverUrl.startsWith('http://')) {
                parsed.serverUrl = parsed.serverUrl.replace('http:/', 'http://');
            }

            return { ...defaultConfig, ...parsed };
        }
    } catch (error) {
        console.warn('Failed to load config.json, using defaults or env');
    }

    return {
        serverUrl: process.env.SERVER_URL || defaultConfig.serverUrl,
        agentId: process.env.AGENT_ID || defaultConfig.agentId,
    };
}
