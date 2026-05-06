import { prisma } from './prisma';

/**
 * Normaliza nomes de interfaces para busca fuzzy
 * Ex: GigabitEthernet1/0/1 -> g1/0/1
 */
export function normalizeInterfaceName(name: string): string {
    return name.toLowerCase()
        .replace(/^gigabitethernet/i, 'g')
        .replace(/^fastethernet/i, 'f')
        .replace(/^tengigabitethernet/i, 't')
        .replace(/^ethernet/i, 'e')
        .replace(/(\/0\/)/g, '/') 
        .replace(/\s+/g, '')
        .split('(')[0]; // Remove parenthetical suffixes like (LAN), (WAN)
}

/**
 * Resolve uma interface pelo nome ou índice, com suporte a busca fuzzy
 */
export async function resolveInterface(deviceId: string, identifier: string) {
    if (!identifier) return null;

    // 1. Tenta correspondência exata por nome
    let iface = await prisma.networkInterface.findFirst({
        where: { deviceId, name: identifier }
    });
    if (iface) return iface;

    // 2. Tenta correspondência exata por índice
    const index = parseInt(identifier);
    if (!isNaN(index)) {
        iface = await prisma.networkInterface.findFirst({
            where: { deviceId, index }
        });
        if (iface) return iface;
    }

    // 3. Busca fuzzy entre todas as interfaces do dispositivo
    const allIfaces = await prisma.networkInterface.findMany({
        where: { deviceId }
    });

    const targetNormalized = normalizeInterfaceName(identifier);
    
    // Tenta encontrar por nome normalizado ou descrição
    iface = allIfaces.find(ni => {
        const niNameNorm = normalizeInterfaceName(ni.name);
        if (niNameNorm === targetNormalized) return true;
        
        // Se o identificador for curto (ex: g48), e o nome no DB for longo (ex: GigabitEthernet1/0/48)
        // a normalização g1/0/48 deve bater se target for g48? 
        // Na verdade, se targetNormalized for substring e terminar com o numero...
        if (targetNormalized.length > 1 && niNameNorm.endsWith(targetNormalized)) return true;
        
        // Tenta na descrição (ifDescr)
        if (ni.description && normalizeInterfaceName(ni.description).includes(targetNormalized)) return true;
        
        return false;
    }) || null;

    return iface;
}
