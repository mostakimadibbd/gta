// Harborfall — Electron shell (PC: Windows + macOS). Loads the built web
// client (client/dist) locally; same codebase as the Vercel web version.
const { app, BrowserWindow, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

let win = null;
function clientIndex() {
  const candidates = [
    path.join(__dirname, "..", "client", "dist", "index.html"), // repo layout
    path.join(process.resourcesPath ?? "", "client", "index.html"), // packaged extraResources
    path.join(__dirname, "client", "index.html"),
  ];
  return candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
}
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 560,
    backgroundColor: "#0d2b2a", title: "Harborfall — Port Sable",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const index = clientIndex();
  if (index) { win.loadFile(index); }
  else {
    win.loadURL("data:text/html,<h1 style='font-family:sans-serif'>Harborfall: build the web client first — cd client && npm run build</h1>");
  }
  if (process.env.HARBORFALL_DEVTOOLS === "1") win.webContents.openDevTools({ mode: "detach" });
  globalShortcut.register("F11", () => { if (win) win.setFullScreen(!win.isFullScreen()); });
  globalShortcut.register("CommandOrControl+Shift+F", () => { if (win) win.setFullScreen(!win.isFullScreen()); });
  win.on("closed", () => { win = null; });
}
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on("will-quit", () => globalShortcut.unregisterAll());
