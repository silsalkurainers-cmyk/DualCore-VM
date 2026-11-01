const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dualcore", {
  version: "1.1.0",
  name: "DualCore VM",
  getStatus: () => ipcRenderer.invoke("vm:status"),
  chooseIso: id => ipcRenderer.invoke("vm:choose-iso", id),
  createDisk: id => ipcRenderer.invoke("vm:create-disk", id),
  startVm: id => ipcRenderer.invoke("vm:start", id),
  stopVm: id => ipcRenderer.invoke("vm:stop", id)
});
