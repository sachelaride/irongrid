import { exec } from 'child_process';
import { platform } from 'os';

export interface PingResult {
    alive: boolean;
    ms?: number;
}

export function pingHost(ip: string): Promise<PingResult> {
    return new Promise((resolve) => {
        const isWin = platform() === 'win32';
        const command = isWin
            ? `ping -n 1 -w 1000 ${ip}`
            : `ping -c 1 -W 1 ${ip}`;

        const start = Date.now();
        console.log(`[Ping] Testing ${ip}...`);

        // Set a timeout to prevent hanging
        const timeout = setTimeout(() => {
            console.log(`[Ping] Timeout for ${ip}`);
            resolve({ alive: false });
        }, 2000); // 2 second timeout

        exec(command, (error, stdout, stderr) => {
            clearTimeout(timeout);
            const duration = Date.now() - start;

            if (error) {
                console.log(`[Ping] Failed for ${ip}: ${error.message}`);
                resolve({ alive: false });
            } else {
                console.log(`[Ping] Success for ${ip}`);
                // Attempt to parse latency from stdout if possible for better accuracy
                let ms = duration;
                const match = stdout.match(/time=([0-9.]+)\s*ms/);
                if (match && match[1]) {
                    ms = parseFloat(match[1]);
                }
                resolve({ alive: true, ms });
            }
        });
    });
}
