const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFile, exec } = require("child_process");

const HOSTS = process.platform === "win32"
  ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "drivers", "etc", "hosts")
  : "/etc/hosts";

const START = "# >>> FOCUS LOCK START >>>";
const END = "# <<< FOCUS LOCK END <<<";

const STATE_FILE = path.join(app.getPath("userData"), "focus-lock-state.json");

let win = null;
let tray = null;
let killTimer = null;
let session = null; // { endsAt, domains, apps }

/* ---------- state ---------- */

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeState(data) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("state write failed", err);
  }
}

/* ---------- hosts file ---------- */

function buildBlock(domains) {
  const lines = [START];
  for (const raw of domains) {
    const d = String(raw).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!d) continue;
    lines.push(`127.0.0.1 ${d}`);
    lines.push(`::1 ${d}`);
    if (!d.startsWith("www.")) {
      lines.push(`127.0.0.1 www.${d}`);
      lines.push(`::1 www.${d}`);
    }
  }
  lines.push(END);
  return lines.join(os.EOL) + os.EOL;
}

function stripBlock(text) {
  const re = new RegExp(`\\n?${START}[\\s\\S]*?${END}\\n?`, "g");
  return text.replace(re, "\n");
}

function readHosts() {
  try {
    return fs.readFileSync(HOSTS, "utf8");
  } catch {
    return "";
  }
}

function writeHosts(content) {
  fs.writeFileSync(HOSTS, content);
}

function flushDns() {
  const cmds = {
    darwin: "dscacheutil -flushcache; killall -HUP mDNSResponder",
    win32: "ipconfig /flushdns",
    linux: "resolvectl flush-caches || systemd-resolve --flush-caches || true",
  };
  const cmd = cmds[process.platform];
  if (cmd) exec(cmd, () => {});
}

function applyBlock(domains) {
  const next = stripBlock(readHosts()).replace(/\n+$/, "\n") + buildBlock(domains);
  writeHosts(next);
  flushDns();
}

function clearBlock() {
  writeHosts(stripBlock(readHosts()).replace(/\n{3,}/g, "\n\n"));
  flushDns();
}

/* ---------- desktop app killing ---------- */

function killApps(names) {
  if (!names || !names.length) return;
  for (const raw of names) {
    const name = String(raw).trim();
    if (!name) continue;
    if (process.platform === "win32") {
      execFile("taskkill", ["/IM", name.endsWith(".exe") ? name : `${name}.exe`, "/F"], () => {});
    } else if (process.platform === "darwin") {
      execFile("pkill", ["-i", "-f", name], () => {});
    } else {
      execFile("pkill", ["-i", "-f", name], () => {});
    }
  }
}

function startKillLoop() {
  stopKillLoop();
  killTimer = setInterval(() => {
    if (!session) return stopKillLoop();
    if (Date.now() >= session.endsAt) return endSession("expired");
    killApps(session.apps);
  }, 4000);
}

function stopKillLoop() {
  if (killTimer) clearInterval(killTimer);
  killTimer = null;
}

/* ---------- session ---------- */

function startSession({ endsAt, domains, apps }) {
  session = { endsAt, domains: domains || [], apps: apps || [] };
  applyBlock(session.domains);
  killApps(session.apps);
  startKillLoop();
  writeState({ session });
  broadcast();
  return status();
}

function endSession(reason) {
  session = null;
  stopKillLoop();
  clearBlock();
  writeState({ session: null, lastEnd: { reason, at: Date.now() } });
  broadcast();
  return status();
}

function status() {
  return {
    active: !!session,
    endsAt: session ? session.endsAt : null,
    domains: session ? session.domains : [],
    apps: session ? session.apps : [],
    platform: process.platform,
    hostsWritable: canWriteHosts(),
  };
}

function canWriteHosts() {
  try {
    fs.accessSync(HOSTS, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function broadcast() {
  if (win && !win.isDestroyed()) win.webContents.send("focus:status", status());
}

/* ---------- ipc ---------- */

ipcMain.handle("focus:status", () => status());
ipcMain.handle("focus:start", (_e, payload) => startSession(payload));
ipcMain.handle("focus:stop", () => endSession("manual"));

/* ---------- window ---------- */

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 720,
    backgroundColor: "#0b0c0f",
    title: "Focus Lock",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "index.html"));
  win.on("closed", () => {
    win = null;
  });
}

app.whenReady().then(() => {
  // Restore an unfinished session after a crash/restart — the block survives.
  const saved = readState();
  if (saved && saved.session && saved.session.endsAt > Date.now()) {
    startSession(saved.session);
  } else if (saved && saved.session) {
    endSession("expired");
  }

  createWindow();

  try {
    tray = new Tray(nativeImage.createEmpty());
    tray.setToolTip("Focus Lock");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open Focus Lock", click: () => (win ? win.show() : createWindow()) },
        { type: "separator" },
        { label: "Quit", click: () => app.quit() },
      ]),
    );
  } catch {
    /* tray is optional */
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  // Do NOT unblock on quit: quitting must not be an escape hatch.
  stopKillLoop();
});
