// IF Screen — Central (processo principal do Electron)
'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { Database } = require('./src/db');
const { Store, localDate, addDays } = require('./src/store');
const { createLocalServer, lanAddresses } = require('./src/localServer');
const { RelaySync } = require('./src/relaySync');
const { buildCsv } = require('./src/exporter');

// pasta de dados fixa: %APPDATA%\IF Screen Central (banco, cópias de segurança, logomarca)
app.setName('IF Screen Central');
app.setPath('userData', path.join(app.getPath('appData'), 'IF Screen Central'));

let win = null; let db = null; let store = null; let local = null; let relay = null;
const runtime = { localPort: null, localError: null, relay: {} };

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

let notifyTimer = null;
function notifyRenderer(what) {
  if (what === 'links' || what === 'settings') relay && relay.markLinksDirty();
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    if (win && !win.isDestroyed()) win.webContents.send('data-updated');
  }, 800);
}
const logFn = (level, msg) => { try { store && store.log(level, msg); } catch (_) { /* */ } console.log(level, msg); };

async function startLocalServer() {
  if (local) { await local.stop().catch(() => {}); local = null; }
  const port = Number(store.setting('localPort')) || 8787;
  local = createLocalServer(store, { port, onLog: logFn });
  try {
    runtime.localPort = await local.start();
    runtime.localError = null;
  } catch (e) {
    runtime.localPort = null;
    runtime.localError = e.code === 'EADDRINUSE' ? `A porta ${port} já está em uso` : e.message;
    logFn('error', runtime.localError);
  }
}

async function boot() {
  const dataDir = app.getPath('userData');
  db = await Database.open(path.join(dataDir, 'ifscreen.db'));
  store = new Store(db, { onChange: notifyRenderer });
  try { db.backup(path.join(dataDir, 'backups')); } catch (e) { logFn('warn', `backup: ${e.message}`); }
  setInterval(() => { try { db.backup(path.join(dataDir, 'backups')); } catch (_) { /* */ } }, 6 * 3600000);
  await startLocalServer();
  relay = new RelaySync(store, { onLog: logFn, onStatus: (s) => { runtime.relay = { ...s }; notifyRenderer('status'); } });
  relay.start();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 880, minWidth: 1100, minHeight: 700,
    backgroundColor: '#F6F9F6', title: 'IF Screen — Central',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    win.show();
    if (process.env.IFS_SMOKE) setTimeout(smokeTest, 3000); // autoteste usado no build
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

async function smokeTest() {
  const img = await win.webContents.capturePage();
  fs.writeFileSync(process.env.IFS_SMOKE, img.toPNG());
  const h = await fetch(`http://127.0.0.1:${runtime.localPort}/health`).then((r) => r.json()).catch((e) => ({ error: e.message }));
  console.log('SMOKE', JSON.stringify({ localPort: runtime.localPort, health: h, userData: app.getPath('userData'), devices: store.devices().length }));
  app.quit();
}

// ------------------------------------------------------------ IPC
const handlers = {
  overview: () => store.overview(),
  devices: () => store.devices(),
  device: (id) => store.device(id),
  link: ({ code, participant }) => store.link(code, participant),
  unlink: (id) => store.unlink(id),
  setStudyStart: ({ deviceId, date }) => store.setStudyStart(deviceId, date),
  days: ({ deviceId, from, to }) => store.days(deviceId, from, to),
  sessions: ({ deviceId, date }) => store.sessions(deviceId, date),
  hourly: ({ deviceId, date }) => store.hourly(deviceId, date),
  questionnaires: ({ from, to }) => store.questionnaires(from, to),
  validation: (opts) => store.validation(opts || {}),
  setReference: ({ deviceId, date, minutes, note }) => store.setReference(deviceId, date, minutes, note),
  settings: () => store.settings(),
  saveSettings: async (obj) => {
    const before = store.setting('localPort');
    store.setSettings(obj);
    if (String(obj.localPort || before) !== String(before)) await startLocalServer();
    relay.start();
    return { ok: true };
  },
  status: () => ({
    localPort: runtime.localPort, localError: runtime.localError, ips: lanAddresses(),
    relay: runtime.relay, today: localDate(), version: app.getVersion(), dataDir: app.getPath('userData'),
  }),
  testRelay: () => relay.test(),
  syncNow: async () => { await relay.tick(); return runtime.relay; },
  logs: () => db.all('SELECT ts, level, msg FROM log ORDER BY ts DESC LIMIT 200'),
  exportCsv: async ({ kind, from, to }) => {
    const { filename, content } = buildCsv(store, kind, { from, to });
    const r = await dialog.showSaveDialog(win, { defaultPath: filename, filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }] });
    if (r.canceled || !r.filePath) return { ok: false };
    fs.writeFileSync(r.filePath, content, 'utf8');
    shell.showItemInFolder(r.filePath);
    return { ok: true, path: r.filePath };
  },
  printPdf: async ({ filename }) => {
    const data = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } });
    const r = await dialog.showSaveDialog(win, { defaultPath: filename || 'relatorio-ifscreen.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (r.canceled || !r.filePath) return { ok: false };
    fs.writeFileSync(r.filePath, data);
    shell.openPath(r.filePath);
    return { ok: true, path: r.filePath };
  },
  chooseLogo: async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Imagem', extensions: ['png', 'jpg', 'jpeg', 'svg'] }] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    const ext = path.extname(r.filePaths[0]).toLowerCase();
    const dest = path.join(app.getPath('userData'), `logo-instituicao${ext}`);
    fs.copyFileSync(r.filePaths[0], dest);
    store.setSettings({ logoFile: dest });
    return { ok: true };
  },
  removeLogo: () => { store.setSettings({ logoFile: '' }); return { ok: true }; },
  logo: () => {
    const f = store.setting('logoFile');
    if (!f || !fs.existsSync(f)) return null;
    const ext = path.extname(f).slice(1).toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`;
  },
  openDataDir: () => shell.openPath(app.getPath('userData')),
  dates: () => ({ today: localDate(), yesterday: addDays(localDate(), -1) }),
};
for (const [name, fn] of Object.entries(handlers)) {
  ipcMain.handle(`api:${name}`, async (_e, arg) => {
    try { return await fn(arg); } catch (e) { logFn('error', `${name}: ${e.stack || e.message}`); return { ok: false, error: e.message }; }
  });
}

app.whenReady().then(async () => {
  await boot();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { try { db && db.flush(); } catch (_) { /* */ } });
