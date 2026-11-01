const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn, spawnSync } = require("child_process");

const VM_DEFINITIONS = {
  windows: { label: "Windows 11", diskName: "windows11.qcow2", defaultDiskGB: 80 },
  arch: { label: "Arch Linux KDE Plasma", diskName: "arch-kde.qcow2", defaultDiskGB: 50 }
};
const running = new Map();
let mainWindow;

function configPath() {
  return path.join(app.getPath("userData"), "vms.json");
}

function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), "utf8")); }
  catch { return { windows: {}, arch: {} }; }
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf8");
}

function findExecutable(name) {
  const result = spawnSync("where.exe", [name], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0 || !result.stdout.trim()) return null;
  return result.stdout.trim().split(/\r?\n/)[0];
}

function getStatus() {
  const config = readConfig();
  const qemu = findExecutable("qemu-system-x86_64.exe") || findExecutable("qemu-system-x86_64");
  const qemuImg = findExecutable("qemu-img.exe") || findExecutable("qemu-img");
  return {
    host: `${os.caption()} (${os.arch()})`,
    qemuFound: Boolean(qemu),
    qemuImgFound: Boolean(qemuImg),
    vms: Object.fromEntries(Object.keys(VM_DEFINITIONS).map(id => [id, {
      ...VM_DEFINITIONS[id],
      isoPath: config[id]?.isoPath || "",
      diskPath: config[id]?.diskPath || "",
      running: running.has(id)
    }]))
  };
}

function requireQemu() {
  const qemu = findExecutable("qemu-system-x86_64.exe") || findExecutable("qemu-system-x86_64");
  if (!qemu) throw new Error("QEMU was not found. Install the 64-bit QEMU for Windows package and add its folder to PATH, then restart DualCore VM.");
  return qemu;
}

ipcMain.handle("vm:status", () => getStatus());

ipcMain.handle("vm:choose-iso", async (_event, id) => {
  if (!VM_DEFINITIONS[id]) throw new Error("Unknown virtual machine.");
  const result = await dialog.showOpenDialog(mainWindow, {
    title: `Select ${VM_DEFINITIONS[id].label} installer ISO`,
    properties: ["openFile"],
    filters: [{ name: "ISO disk images", extensions: ["iso"] }]
  });
  if (result.canceled || !result.filePaths[0]) return getStatus();
  const config = readConfig();
  config[id] = { ...config[id], isoPath: result.filePaths[0] };
  writeConfig(config);
  return getStatus();
});

ipcMain.handle("vm:create-disk", async (_event, id) => {
  if (!VM_DEFINITIONS[id]) throw new Error("Unknown virtual machine.");
  const qemuImg = findExecutable("qemu-img.exe") || findExecutable("qemu-img");
  if (!qemuImg) throw new Error("qemu-img was not found. Install QEMU for Windows and add its folder to PATH.");
  const definition = VM_DEFINITIONS[id];
  const result = await dialog.showSaveDialog(mainWindow, {
    title: `Create ${definition.label} virtual disk`,
    defaultPath: path.join(app.getPath("documents"), definition.diskName),
    buttonLabel: "Create virtual disk",
    filters: [{ name: "QEMU virtual disk", extensions: ["qcow2"] }]
  });
  if (result.canceled || !result.filePath) return getStatus();
  if (fs.existsSync(result.filePath)) throw new Error("That file already exists. Choose a new filename so existing data is not overwritten.");
  const sizeGB = definition.defaultDiskGB;
  await new Promise((resolve, reject) => {
    const child = spawn(qemuImg, ["create", "-f", "qcow2", result.filePath, `${sizeGB}G`], { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(stderr || `qemu-img exited with code ${code}`)));
  });
  const config = readConfig();
  config[id] = { ...config[id], diskPath: result.filePath };
  writeConfig(config);
  return getStatus();
});

ipcMain.handle("vm:start", async (_event, id) => {
  if (!VM_DEFINITIONS[id]) throw new Error("Unknown virtual machine.");
  if (running.has(id)) throw new Error("This virtual machine is already running.");
  const qemu = requireQemu();
  const config = readConfig();
  const vm = config[id] || {};
  if (!vm.diskPath || !fs.existsSync(vm.diskPath)) throw new Error("Create a virtual disk first.");
  if (vm.isoPath && !fs.existsSync(vm.isoPath)) throw new Error("The selected ISO file cannot be found. Select it again.");
  const args = [
    "-machine", "q35",
    "-accel", "whpx",
    "-cpu", "max",
    "-m", id === "windows" ? "8192" : "4096",
    "-smp", "4",
    "-drive", `file=${vm.diskPath},if=virtio,format=qcow2`,
    "-device", "virtio-vga",
    "-netdev", "user,id=net0",
    "-device", "e1000,netdev=net0",
    "-display", "sdl"
  ];
  if (vm.isoPath) args.push("-cdrom", vm.isoPath, "-boot", "order=d");
  const child = spawn(qemu, args, { windowsHide: false, stdio: "ignore" });
  running.set(id, child);
  child.on("error", () => running.delete(id));
  child.on("close", () => running.delete(id));
  return getStatus();
});

ipcMain.handle("vm:stop", async (_event, id) => {
  const child = running.get(id);
  if (!child) return getStatus();
  if (process.platform === "win32" && child.pid) {
    await new Promise(resolve => {
      const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
      killer.on("close", resolve);
      killer.on("error", resolve);
    });
  } else child.kill("SIGTERM");
  running.delete(id);
  return getStatus();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: "#080808",
    title: "DualCore VM",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  if (process.platform !== "win32") {
    dialog.showErrorBox("Unsupported host", "This build currently supports Windows 10 and Windows 11 hosts.");
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  for (const child of running.values()) {
    if (child.pid) spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
