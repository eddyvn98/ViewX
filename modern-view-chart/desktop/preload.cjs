/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vivutradeDesktop", {
  isNativeDesktop: true,
  openExternal: async (url) => ipcRenderer.invoke("desktop:openExternal", url),
  getStatus: async () => ipcRenderer.invoke("desktop:getStatus"),
  openLogs: async () => ipcRenderer.invoke("desktop:openLogs"),
  openSettings: async () => ipcRenderer.invoke("desktop:openSettings"),
  restartBridge: async () => ipcRenderer.invoke("desktop:restartBridge"),
  onStatus: (handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("desktop:status", listener);
    return () => ipcRenderer.removeListener("desktop:status", listener);
  },
});

