import axios from 'axios';

export const DEFAULT_RPC_CONFIG = {
  mode: 'electrum',
  ip: 'palladiumblockchain.net',
  port: '50002',
  user: '',
  pass: '',
  lang: 'en',
  showTxid: true,
  retentionDays: 0,
  rescanHours: 0,
  feeRate: 1,
  defaultAmount: 0,
  allowUnconfirmedSpend: true,
  configVersion: 3
};

function resolveRpcHost(ip) {
  try {
    const platform = globalThis?.Capacitor?.getPlatform?.();
    if (platform === 'android' && (ip === 'localhost' || ip === '127.0.0.1')) {
      return '10.0.2.2';
    }
  } catch {
    return ip;
  }
  return ip;
}

const wsConnections = new Map();

async function getWebSocket(host, port) {
  const url = `wss://${host}:${port}`;
  if (wsConnections.has(url)) {
    const existing = wsConnections.get(url);
    if (existing.readyState === WebSocket.OPEN) return existing;
    if (existing.readyState === WebSocket.CONNECTING) {
      await new Promise(r => setTimeout(r, 500));
      return getWebSocket(host, port);
    }
  }

  const ws = new WebSocket(url);
  wsConnections.set(url, ws);
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 10000);
    ws.onopen = () => {
      clearTimeout(timeout);
      resolve(ws);
    };
    ws.onerror = (err) => {
      clearTimeout(timeout);
      wsConnections.delete(url);
      reject(err);
    };
  });
}

export async function rpcCall(config, method, params = []) {
  if (config?.mode === 'electrum') {
    if (typeof window !== 'undefined' && window.electron?.rpc?.invoke) {
      return window.electron.rpc.invoke({
        transport: 'electrum',
        config,
        method,
        params
      });
    }
    
    // Browser / Web Support via WebSocket
    if (typeof window !== 'undefined' && typeof WebSocket !== 'undefined') {
      let wsHost = config.ip;
      let wsPort = config.port === '50002' ? '50004' : config.port;
      
      // Auto-switch to our optimized VPS endpoint if on our domain
      if (window.location.hostname.includes('palladium-coin.com') || config.ip === 'palladiumblockchain.net') {
        wsHost = 'wss.palladium-coin.com';
        wsPort = '443'; // NPM will handle the SSL termination and proxy to 50004
      }
      
      const ws = await getWebSocket(wsHost, wsPort);
      
      // Ensure session is initialized with server.version if needed
      if (method !== 'server.version' && !ws.versionHandshake) {
        ws.versionHandshake = true;
        await rpcCall(config, 'server.version', ['palladium-secure-chat', '1.4']);
      }

      const id = Math.floor(Math.random() * 1000000);
      const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      
      return new Promise((resolve, reject) => {
        const handler = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.id === id) {
              ws.removeEventListener('message', handler);
              if (data.error) reject(new Error(data.error.message));
              else resolve(data.result);
            }
          } catch {}
        };
        ws.addEventListener('message', handler);
        ws.send(payload + '\n');
      });
    }
    
    throw new Error('Electrum transport requires Electron or WebSocket support');
  }

  if (typeof window !== 'undefined' && window.electron?.rpc?.invoke) {
    return window.electron.rpc.invoke({ transport: 'rpc', config, method, params });
  }

  const host = resolveRpcHost(config.ip);
  const url = `http://${host}:${config.port}`;
  const response = await axios.post(
    url,
    {
      jsonrpc: '1.0',
      id: 'palladium-client',
      method,
      params
    },
    {
      auth: {
        username: config.user,
        password: config.pass
      },
      timeout: 10000
    }
  );

  if (response.data?.error) {
    throw new Error(response.data.error.message);
  }

  return response.data?.result;
}
