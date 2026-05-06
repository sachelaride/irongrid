declare module 'net-snmp' {
    export interface Session {
        get(oids: string[], callback: (error: any, varbinds: Varbind[]) => void): void;
        walk(oid: string, maxRepetitions: number, feedCallback: (varbinds: Varbind[]) => void, doneCallback: (error: any) => void): void;
        close(): void;
    }

    export interface Varbind {
        oid: string;
        type: number;
        value: Buffer | number | string;
    }

    export function createSession(target: string, community: string, options?: any): Session;
    export function isVarbindError(varbind: Varbind): boolean;
}
