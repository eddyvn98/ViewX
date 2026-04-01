const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vivutradeDesktop", {
  openExternal: async (url) => ipcRenderer.invoke("desktop:openExternal", url),
});

