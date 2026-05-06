/**
 * Serviço de Verificação de Conectividade (Ping) Robustecido
 * 
 * Abstração sobre o comando `ping` do sistema operacional para validar se um dispositivo
 * está alcançável na rede e medir sua latência. Inclui fallback para TCP e ARP.
 * 
 * @module services/pingService
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';

const execAsync = promisify(exec);

/** Resultado da operação de ping para um host */
export interface PingResult {
    /** IP que foi testado */
    ip: string;
    /** Indica se houve resposta (ICMP, TCP ou ARP) */
    success: boolean;
    /** Tempo de resposta em milissegundos (se houver sucesso via ICMP) */
    latency?: number;
    /** Método que confirmou a existência do host */
    method?: 'icmp' | 'tcp' | 'arp';
    /** Descrição do erro em caso de falha */
    error?: string;
}

export class PingService {
    // Portas comuns para verificar se um dispositivo está vivo quando ICMP falha
    private static COMMON_PORTS = [22, 80, 161, 443, 3389, 8080];

    /**
     * Ping - Testar conectividade de um único IP com múltiplos fallbacks
     */
    async ping(ip: string): Promise<PingResult> {
        // 1. Tentar ICMP Ping
        try {
            const { stdout } = await execAsync(`ping -c 1 -W 1 ${ip}`, { timeout: 1500 });
            const match = stdout.match(/time=(\d+\.?\d*)/);
            const latency = match ? parseFloat(match[1]) : undefined;

            return { ip, success: true, latency, method: 'icmp' };
        } catch (error: any) {
            // ICMP falhou, continuar para fallbacks
        }

        // 2. Tentar TCP Scan (Paralelo)
        const tcpAlive = await this.scanPortsParallel(ip);
        if (tcpAlive) {
            return {
                ip,
                success: true,
                latency: 10, // Latência simulada para TCP-alive
                method: 'tcp'
            };
        }

        // 3. Tentar Check na tabela ARP local
        const arpMac = await this.checkLocalArp(ip);
        if (arpMac) {
            return {
                ip,
                success: true,
                latency: 5, // ARP costuma ser muito rápido
                method: 'arp'
            };
        }

        return {
            ip,
            success: false,
            error: 'Host unreachable (ICMP, TCP & ARP failed)'
        };
    }

    /**
     * Verifica múltiplas portas em paralelo
     */
    private async scanPortsParallel(ip: string): Promise<boolean> {
        const checks = PingService.COMMON_PORTS.map(port => this.isPortOpen(ip, port, 800));
        
        // Retorna TRUE se QUALQUER uma das portas responder
        const results = await Promise.all(checks);
        return results.some(Boolean);
    }

    /**
     * Helper para verificar se uma porta TCP está aberta
     */
    private isPortOpen(ip: string, port: number, timeout = 1000): Promise<boolean> {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(timeout);
            
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });

            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });

            socket.on('error', () => {
                socket.destroy();
                resolve(false);
            });

            socket.connect(port, ip);
        });
    }

    /**
     * Verifica se o IP consta na tabela ARP local do sistema
     */
    private async checkLocalArp(ip: string): Promise<string | null> {
        try {
            // Prefer 'ip neigh show' as it provides granular state (REACHABLE, STALE, etc.)
            const { stdout } = await execAsync('ip neigh show 2>/dev/null || arp -n 2>/dev/null');
            const lines = stdout.split('\n');
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts[0] === ip) {
                    const mac = parts.find(p => /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(p));
                    if (!mac) continue;

                    // If output is from 'ip neigh', validate state
                    // Format: <ip> dev <iface> lladdr <mac> <STATE>
                    if (line.includes('lladdr')) {
                        const state = parts[parts.length - 1].toUpperCase();
                        const activeStates = ['REACHABLE', 'DELAY', 'PROBE', 'PERMANENT', 'STALE'];
                        if (!activeStates.includes(state)) continue; 
                    }

                    return mac;
                }
            }
        } catch { /* ignore */ }
        return null;
    }

    /**
     * Bulk Ping - Testar múltiplos IPs em paralelo
     */
    async bulkPing(ips: string[]): Promise<PingResult[]> {
        // Para evitar estourar limites de file descriptors ou CPU, processamos em chunks se a lista for grande
        const CHUNK_SIZE = 50;
        const allResults: PingResult[] = [];

        for (let i = 0; i < ips.length; i += CHUNK_SIZE) {
            const chunk = ips.slice(i, i + CHUNK_SIZE);
            const results = await Promise.all(chunk.map(ip => this.ping(ip)));
            allResults.push(...results);
        }

        return allResults;
    }
}
