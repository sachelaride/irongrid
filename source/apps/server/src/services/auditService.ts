/**
 * Serviço de Auditoria (Audit Log)
 * 
 * Centraliza o registro de ações críticas realizadas no sistema para fins de
 * conformidade, segurança e depuração. Todas as alterações em recursos sensíveis
 * devem ser registradas através deste serviço.
 * 
 * Recursos auditados comuns:
 * - Usuários (Login, Criação, Alteração de Perfil)
 * - Dispositivos (Criação, Exclusão, Alteração de Configuração)
 * - Alertas (Criação, Resolução)
 * - Tickets (Abertura, Mudança de Status, Atribuição)
 * 
 * @module services/auditService
 */

import { prisma } from '../utils/prisma';

export class AuditService {
    /**
     * Log - Registrar uma nova entrada de auditoria
     * 
     * @param {Object} data - Dados do log
     * @param {string} data.action - Nome da ação realizada (ex: 'CREATE_USER', 'DELETE_DEVICE')
     * @param {string} data.resource - Tipo do recurso afetado (ex: 'User', 'Device', 'Ticket')
     * @param {string} [data.resourceId] - ID único do recurso afetado
     * @param {string} [data.userId] - ID do usuário que realizou a ação (padrão: 'system')
     * @param {any} [data.details] - Objeto JSON com detalhes adicionais ou estados anterior/posterior
     * @param {string} [data.ipAddress] - Endereço IP de origem da requisição
     */
    static async log(data: {
        action: string;
        resource: string;
        resourceId?: string;
        userId?: string;
        details?: any;
        ipAddress?: string;
    }) {
        try {
            return await (prisma as any).auditLog.create({
                data: {
                    action: data.action,
                    resource: data.resource,
                    resourceId: data.resourceId,
                    userId: data.userId || 'system',
                    details: data.details || {},
                    ipAddress: data.ipAddress
                }
            });
        } catch (error) {
            console.error('[AuditService] Failed to create audit log:', error);
        }
    }
}
