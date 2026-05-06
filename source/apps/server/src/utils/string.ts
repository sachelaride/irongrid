/**
 * Utilitários de manipulação de Strings para o Servidor IronGrid.
 */

/**
 * Sanitize SNMP String
 * 
 * Remove bytes nulos (0x00) e caracteres de controle não-imprimíveis que podem
 * causar erros de codificação (invalid byte sequence for encoding "UTF8") 
 * ao persistir dados no PostgreSQL via Prisma.
 * 
 * @param str String original vinda do SNMP
 * @returns String sanitizada e limpa
 */
export function sanitizeSnmpString(str: string | undefined | null): string {
    if (!str) return '';
    
    // 3. Heurística para correção de acentuação Windows (Latin1 -> UTF8)
    // Se encontrarmos o padrão de caractere quebrado (ex: '\ufffd'), tentamos limpar.
    // Para simplificar, vamos substituir padrões comuns que aparecem quebrados no SNMP Windows
    let cleanStr = str
        .replace(/\0/g, '') 
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Correção manual de padrões comuns de "Conexão" e outros
    // No SNMP, \xe7\xe3o vira um buraquinho no UTF-8.
    // Aqui fazemos um "patch" para os nomes de interface mais comuns
    cleanStr = cleanStr
        .replace(/Conex.o/g, 'Conexão')
        .replace(/Padr.o/g, 'Padrão')
        .replace(/Usu.rio/g, 'Usuário')
        .replace(/Rede Local.([0-9])/g, 'Rede Local $1');

    return cleanStr.trim();
}
