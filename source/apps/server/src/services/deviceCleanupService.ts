/**
 * Serviço de Limpeza de Dispositivos (Device Cleanup)
 * 
 * Gerencia a remoção automática de dispositivos que permanecem offline por períodos
 * prolongados. O objetivo é manter o inventário limpo e remover ativos que não
 * fazem mais parte da rede monitorada.
 * 
 * Regras de Negócio:
 * - Monitora o tempo offline via campo `offlineSince`.
 * - Emite avisos prévios antes da exclusão definitiva.
 * - Remoção automática de dispositivos offline por mais de 45 dias.
 * 
 * @module services/deviceCleanupService
 */

import { prisma } from '../utils/prisma';
import { NotificationService } from './notificationService';

export class DeviceCleanupService {
    /** Limite de dias para exclusão automática (45 dias) */
    private static readonly OFFLINE_THRESHOLD_DAYS = 45;
    /** Limite de dias para emissão de aviso (40 dias) */
    private static readonly WARNING_THRESHOLD_DAYS = 40;

    /**
     * Update Device Status - Atualizar estado de disponibilidade
     * 
     * Chamado sempre que o status de um dispositivo muda (ONLINE/OFFLINE).
     * Se mudar para OFFLINE, registra o horário atual no `offlineSince`.
     * Se mudar para ONLINE, limpa o contador de tempo offline.
     * 
     * @param {string} deviceId - ID do dispositivo
     * @param {string} newStatus - Novo status (ONLINE/OFFLINE)
     */
    static async updateDeviceStatus(deviceId: string, newStatus: string): Promise<void> {
        try {
            const device = await prisma.device.findUnique({
                where: { id: deviceId },
                select: { status: true, offlineSince: true, name: true }
            });

            if (!device) return;

            // MUDANÇA PARA OFFLINE
            if (newStatus === 'OFFLINE' && device.status !== 'OFFLINE') {
                await prisma.device.update({
                    where: { id: deviceId },
                    data: { offlineSince: new Date() }
                });
                console.log(`[DeviceCleanupService] Device ${device.name} marked offline`);
            }

            // VOLTA PARA ONLINE
            if (newStatus === 'ONLINE' && device.status === 'OFFLINE') {
                await prisma.device.update({
                    where: { id: deviceId },
                    data: { offlineSince: null }
                });
                console.log(`[DeviceCleanupService] Device ${device.name} back online, cleared offline timestamp`);
            }
        } catch (error) {
            console.error('[DeviceCleanupService] Error updating device status:', error);
        }
    }

    /**
     * Run Cleanup Job - Executar Processo de Limpeza
     * 
     * Verifica todos os dispositivos offline e aplica as regras de aviso e exclusão.
     * Deve ser executado periodicamente (ex: uma vez por dia).
     * 
     * @returns {Promise<Object>} Resumo da execução (avisos emitidos e exclusões realizadas)
     */
    static async runCleanupJob(): Promise<{
        warned: number;
        deleted: number;
        devices: Array<{ id: string; name: string; daysOffline: number }>;
    }> {
        console.log('[DeviceCleanupService] Running cleanup job...');

        try {
            // Busca todos os dispositivos offline com data registrada
            const offlineDevices = await prisma.device.findMany({
                where: {
                    status: 'OFFLINE',
                    offlineSince: { not: null }
                },
                select: {
                    id: true,
                    name: true,
                    ipAddress: true,
                    offlineSince: true,
                    departmentRef: true
                }
            });

            const now = new Date();
            const cutoffDate = new Date();
            cutoffDate.setDate(now.getDate() - this.OFFLINE_THRESHOLD_DAYS);

            const warningDate = new Date();
            warningDate.setDate(now.getDate() - this.WARNING_THRESHOLD_DAYS);

            let warned = 0;
            let deleted = 0;
            const deletedDevices: Array<{ id: string; name: string; daysOffline: number }> = [];

            for (const device of offlineDevices) {
                if (!device.offlineSince) continue;

                const daysOffline = Math.floor(
                    (now.getTime() - device.offlineSince.getTime()) / (1000 * 60 * 60 * 24)
                );

                // EXCLUIR dispositivos offline há >= 45 dias
                if (device.offlineSince <= cutoffDate) {
                    console.log(`[DeviceCleanupService] Deleting device ${device.name} (${daysOffline} days offline)`);

                    // Notifica antes de deletar
                    await NotificationService.notifyCritical(
                        `Dispositivo Removido Automaticamente`,
                        `O dispositivo "${device.name}" (${device.ipAddress}) foi removido automaticamente após ${daysOffline} dias offline.`
                    );

                    // Deleta o dispositivo (Cascade handle as relações)
                    await prisma.device.delete({
                        where: { id: device.id }
                    });

                    deletedDevices.push({
                        id: device.id,
                        name: device.name,
                        daysOffline
                    });

                    deleted++;
                }
                // AVISAR para dispositivos offline há >= 40 dias (janela de 5 dias de aviso)
                else if (device.offlineSince <= warningDate) {
                    const daysUntilDeletion = this.OFFLINE_THRESHOLD_DAYS - daysOffline;
                    console.log(`[DeviceCleanupService] Warning for device ${device.name} (${daysOffline} days offline, ${daysUntilDeletion} days until deletion)`);

                    await NotificationService.notifyCritical(
                        `Aviso: Dispositivo Será Removido`,
                        `O dispositivo "${device.name}" (${device.ipAddress}) está offline há ${daysOffline} dias e será removido automaticamente em ${daysUntilDeletion} dias se não voltar online.`
                    );

                    warned++;
                }
            }

            console.log(`[DeviceCleanupService] Cleanup complete: ${warned} warnings, ${deleted} deletions`);

            return {
                warned,
                deleted,
                devices: deletedDevices
            };
        } catch (error) {
            console.error('[DeviceCleanupService] Error during cleanup job:', error);
            throw error;
        }
    }

    /**
     * Get Devices At Risk - Listar dispositivos em risco de exclusão
     * 
     * Retorna a lista de dispositivos que já entraram na janela de aviso (40+ dias offline).
     */
    static async getDevicesAtRisk(): Promise<Array<{
        id: string;
        name: string;
        ipAddress: string;
        daysOffline: number;
        daysUntilDeletion: number;
    }>> {
        const offlineDevices = await prisma.device.findMany({
            where: {
                status: 'OFFLINE',
                offlineSince: { not: null }
            },
            select: {
                id: true,
                name: true,
                ipAddress: true,
                offlineSince: true
            }
        });

        const now = new Date();
        const results: Array<{
            id: string;
            name: string;
            ipAddress: string;
            daysOffline: number;
            daysUntilDeletion: number;
        }> = [];

        for (const device of offlineDevices) {
            if (!device.offlineSince) continue;

            const daysOffline = Math.floor(
                (now.getTime() - device.offlineSince.getTime()) / (1000 * 60 * 60 * 24)
            );

            const daysUntilDeletion = this.OFFLINE_THRESHOLD_DAYS - daysOffline;

            if (daysOffline >= this.WARNING_THRESHOLD_DAYS) {
                results.push({
                    id: device.id,
                    name: device.name,
                    ipAddress: device.ipAddress,
                    daysOffline,
                    daysUntilDeletion: Math.max(0, daysUntilDeletion)
                });
            }
        }

        return results.sort((a, b) => a.daysUntilDeletion - b.daysUntilDeletion);
    }

    /**
     * Get Configuration - Obter parâmetros atuais
     */
    static getConfiguration() {
        return {
            offlineThresholdDays: this.OFFLINE_THRESHOLD_DAYS,
            warningThresholdDays: this.WARNING_THRESHOLD_DAYS
        };
    }
}
