const { app, BrowserWindow, ipcMain } = require('electron');
const tls = require('tls');
const path = require('path');

// Raspberry Pi/Wayland GBM issues: force X11 + software rendering.
process.env.ELECTRON_OZONE_PLATFORM_HINT = 'x11';
app.commandLine.appendSwitch('ozone-platform', 'x11');
app.commandLine.appendSwitch('disable-features', 'UseOzonePlatform,WaylandWindowDecorations');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('use-gl', 'swiftshader');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.disableHardwareAcceleration();

class ElectrumClient {
  constructor(host, port) {
    this.host = host;
    this.port = Number(port);
    this.socket = null;
    this.buffer = '';
    this.pending = new Map();
    this.nextId = 1;
    this.serverVersion = null;
  }

  async connect() {
    if (this.socket && !this.socket.destroyed) return;

    this.socket = tls.connect(
      {
        host: this.host,
        port: this.port,
        servername: this.host,
        rejectUnauthorized: false
      },
      () => {}
    );

    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk) => this.onData(chunk));
    this.socket.on('error', (err) => this.onError(err));
    this.socket.on('close', () => this.onClose());
  }

  onData(chunk) {
    this.buffer += chunk;
    let index;
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject, method } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) {
            const message = msg.error.message || 'Electrum error';
            if (method === 'server.version') {
              resolve(this.serverVersion || msg.result || ['palladium-secure-chat', '1.4']);
            } else {
              reject(new Error(message));
            }
          } else {
            if (method === 'server.version') this.serverVersion = msg.result;
            resolve(msg.result);
          }
        }
      } catch {
        // Ignore parse errors.
      }
    }
  }

  onError(err) {
    for (const { reject } of this.pending.values()) {
      reject(err);
    }
    this.pending.clear();
  }

  onClose() {
    for (const { reject } of this.pending.values()) {
      reject(new Error('Electrum connection closed'));
    }
    this.pending.clear();
  }

  async request(method, params = []) {
    await this.connect();
    if (method === 'server.version' && this.serverVersion) {
      return this.serverVersion;
    }
    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.write(payload, 'utf8', (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }
}

const electrumClients = new Map();

function getElectrumClient(host, port) {
  const key = `${host}:${port}`;
  if (!electrumClients.has(key)) {
    electrumClients.set(key, new ElectrumClient(host, port));
  }
  return electrumClients.get(key);
}

ipcMain.handle('rpc-call', async (_event, payload) => {
  const { transport = 'rpc', config, method, params = [] } = payload || {};
  if (!config || !method) {
    throw new Error('Missing RPC payload');
  }

  if (transport === 'electrum' || config.mode === 'electrum') {
    const client = getElectrumClient(config.ip, config.port);
    return client.request(method, params);
  }

  const url = `http://${config.ip}:${config.port}`;
  const auth = Buffer.from(`${config.user}:${config.pass}`).toString('base64');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Basic ${auth}`
    },
    body: JSON.stringify({
      jsonrpc: '1.0',
      id: 'palladium-client',
      method,
      params
    })
  });

  const data = await response.json();
  if (data?.error) {
    throw new Error(data.error.message);
  }
  return data?.result;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#050505',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      sandbox: false
    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../public/logo_3.png')
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    win.loadURL('http://localhost:5173');
    if (process.env.ELECTRON_DEVTOOLS === '1') {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
