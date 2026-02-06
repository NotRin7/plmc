const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  rpc: {
    invoke(payload) {
      return ipcRenderer.invoke('rpc-call', payload);
    }
  }
});
