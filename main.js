const { app, BrowserWindow, screen, ipcMain, clipboard, shell } = require('electron');
const path = require('path');

const MODES = {
  rail: { width: 72, height: 84 },
  list: { width: 340, height: null },
  detail: { width: 680, height: null }
};

let win = null;
let currentMode = 'rail';

function workArea() {
  return screen.getPrimaryDisplay().workArea;
}

function placeWindow(mode) {
  if (!win) return;
  const area = workArea();
  const spec = MODES[mode];
  const width = spec.width;
  const height = spec.height || area.height;
  const x = area.x + area.width - width;
  const y = area.y + (mode === 'rail' ? area.height - spec.height - 28 : 0);
  win.setBounds({ x, y, width, height });
}

function createWindow() {
  win = new BrowserWindow({
    width: MODES.rail.width,
    height: MODES.rail.height,
    frame: false,
    transparent: false,
    backgroundColor: '#161922',
    icon: path.join(__dirname, 'renderer', 'assets', 'tasknavigator-mark.png'),
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });
  win.on('close', e => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    placeWindow('rail');
    ipcMain.on('window-mode', (_e, mode) => {
      if (!MODES[mode]) return;
      currentMode = mode;
      placeWindow(mode);
      if (win && !win.isDestroyed()) win.webContents.send('window-mode-applied', mode);
    });
    ipcMain.on('window-hide', () => {
      win.hide();
    });
    ipcMain.on('copy-text', (_e, text) => {
      clipboard.writeText(String(text || ''));
    });
    ipcMain.handle('open-codex-thread', async (_e, threadId) => {
      const id = String(threadId || '').trim();
      if (!id) return { ok: false, error: 'missing_thread_id' };
      try {
        await shell.openExternal(`codex://threads/${encodeURIComponent(id)}`);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err && err.message ? err.message : 'open_failed' };
      }
    });
    ipcMain.handle('open-claude-session', async (_e, cwd) => {
      const dir = String(cwd || '').trim();
      if (!dir) return { ok: false, error: 'missing_cwd' };
      try {
        await shell.openExternal(`vscode://file/${encodeURIComponent(dir)}`);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err && err.message ? err.message : 'open_failed' };
      }
    });
  });
}

app.on('window-all-closed', () => {
  // keep running in background; only quit explicitly
});
