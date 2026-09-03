const { app, BrowserWindow, screen, ipcMain, clipboard, shell } = require('electron');
const path = require('path');

// The overlay used to resize the OS window on every mode switch
// (rail 72 -> list 340 -> detail 680). Windows repaints the frame at the new
// geometry before the renderer can deliver a frame for that size, so every
// switch flashed. The window is now one fixed-size transparent surface docked
// to the right edge of the work area; switching modes only toggles CSS inside
// the renderer, which is applied atomically and cannot tear.
const OVERLAY_WIDTH = 680;
const MODES = ['rail', 'list', 'detail'];

let win = null;
let currentMode = 'rail';
let ignoringMouse = null;

function workArea() {
  return screen.getPrimaryDisplay().workArea;
}

function overlayBounds() {
  const area = workArea();
  return {
    x: area.x + area.width - OVERLAY_WIDTH,
    y: area.y,
    width: OVERLAY_WIDTH,
    height: area.height
  };
}

function dockWindow() {
  if (!win || win.isDestroyed()) return;
  win.setBounds(overlayBounds());
}

// Only the painted panels should catch the mouse; the rest of the fixed frame
// is transparent and has to stay click-through. Mouse move messages are
// forwarded while ignoring, so the renderer can tell when the pointer crosses
// into a painted area and flip this back.
function setIgnoreMouse(ignore) {
  if (!win || win.isDestroyed()) return;
  if (ignoringMouse === ignore) return;
  ignoringMouse = ignore;
  win.setIgnoreMouseEvents(ignore, { forward: true });
}

function createWindow() {
  const bounds = overlayBounds();
  win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
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
  setIgnoreMouse(true);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    dockWindow();
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
    screen.on('display-metrics-changed', dockWindow);
    screen.on('display-added', dockWindow);
    screen.on('display-removed', dockWindow);
    ipcMain.on('window-mode', (_e, mode) => {
      // No resize here on purpose: the frame stays put, the renderer owns the
      // visible size of each mode.
      if (!MODES.includes(mode)) return;
      currentMode = mode;
      if (win && !win.isDestroyed()) win.webContents.send('window-mode-applied', mode);
    });
    ipcMain.on('set-ignore-mouse', (_e, ignore) => {
      setIgnoreMouse(!!ignore);
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
