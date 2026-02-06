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
  defaultAmount: 300,
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
    throw new Error('Electrum transport requires Electron');
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
