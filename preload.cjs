const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("focusAgent", {
  getStatus: () => ipcRenderer.invoke("focus:status"),
  start: (payload) => ipcRenderer.invoke("focus:start", payload),
  stop: () => ipcRenderer.invoke("focus:stop"),
  onStatus: (cb) => {
    const handler = (_e, status) => cb(status);
    ipcRenderer.on("focus:status", handler);
    return () => ipcRenderer.removeListener("focus:status", handler);
  },
});
