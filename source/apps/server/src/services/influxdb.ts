/**
 * Utilitário de Conexão InfluxDB
 * 
 * Centraliza a configuração e o cliente de acesso ao banco de dados InfluxDB,
 * utilizado para armazenamento de séries temporais (métricas de CPU, RAM, Rede, etc).
 * 
 * @module services/influxdb
 */

import { InfluxDB } from '@influxdata/influxdb-client';

// Configurações de conexão (Injetadas via variáveis de ambiente)
const url = process.env.INFLUX_URL || 'http://localhost:8086';
const token = process.env.INFLUX_TOKEN || '';
const org = process.env.INFLUX_ORG || 'netmonitor';
const bucket = process.env.INFLUX_BUCKET || 'metrics';

// Validação básica do Token para evitar erros de ingestão silenciosos
if (token === 'my-token' || !token) {
    console.warn('[InfluxDB Service] WARNING: InfluxDB token is missing or default. Ingestion will fail.');
} else {
    console.log('[InfluxDB Service] Initialized:', {
        url,
        org,
        bucket,
        tokenPrefix: token.substring(0, 5) + '...'
    });
}

/** Instância única do cliente InfluxDB configurada */
const influxDBClient = new InfluxDB({ url, token });

/**
 * Interface de abstração para operações comuns no InfluxDB.
 * Exporta APIs de Escrita (writeApi), Consulta (queryApi) e helpers.
 */
export const influxDB = {
    client: influxDBClient,
    /** API para envio de novos pontos de métricas */
    get writeApi() {
        return influxDBClient.getWriteApi(process.env.INFLUX_ORG || org, process.env.INFLUX_BUCKET || bucket);
    },
    /** API para execução de consultas Flux */
    get queryApi() {
        return influxDBClient.getQueryApi(process.env.INFLUX_ORG || org);
    },
    /** Nome da organização configurada */
    get org() { return process.env.INFLUX_ORG || org; },
    /** Nome do bucket de destino */
    get bucket() { return process.env.INFLUX_BUCKET || bucket; },
    
    /**
     * Helper para consulta de linhas (Rows)
     */
    queryRows: async (query: string) => {
        const currentOrg = process.env.INFLUX_ORG || org;
        return await influxDBClient.getQueryApi(currentOrg).collectRows(query);
    }
};
