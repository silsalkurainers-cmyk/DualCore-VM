
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("dualcore", {
  version: "1.0.0",
  name: "DualCore VM"
});
