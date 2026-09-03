const { app, BrowserWindow, screen, ipcMain, clipboard, shell } = require('electron');
const path = require('path');

const MODES = {
  rail: { width: 72, height: 84 },
  list: { width: 340, height: null },
  detail: { width: 680, height: null }
};

// How far above the taskbar the collapsed puck sits the very first time.
const RAIL_BOTTOM_GAP = 28;

let win = null;
let currentMode = 'rail';

// Where the user last dragged the widget to. Recomputing the position from the
// screen edge on every mode switch is what used to teleport the puck back to
// the bottom-right corner after expanding and collapsing again.
//
// The puck and the expanded panels are remembered separately because they are
// different shapes: the puck is a small free-floating icon that can sit
// anywhere, while the panels are full-height columns whose only free coordinate
// is horizontal. A single stored point cannot describe both.
let railPos = null;    // top-left corner of the collapsed puck
let panelRight = null; // right edge of the expanded panels; null = follow the puck

// The bounds we set ourselves, so the 'moved' handler can tell our own resizing
// apart from the user actually dragging the window somewhere new.
let lastPlaced = null;

function workArea() {
  return screen.getPrimaryDisplay().workArea;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function defaultRailPos() {
  const area = workArea();
  return {
    x: area.x + area.width - MODES.rail.width,
    y: area.y + area.height - MODES.rail.height - RAIL_BOTTOM_GAP
  };
}

// Every position is clamped to the current work area, so a remembered spot can
// never strand the window off-screen after the taskbar moves or the resolution
// changes.
function targetBounds(mode) {
  const area = workArea();
  const spec = MODES[mode];
  const width = spec.width;
  const height = spec.height || area.height;
  if (mode === 'rail') {
    const pos = railPos || defaultRailPos();
    return {
      width,
      height,
      x: clamp(pos.x, area.x, area.x + area.width - width),
      y: clamp(pos.y, area.y, area.y + area.height - height)
    };
  }
  // Expanded panels are full height, so only the horizontal anchor is free.
  // Until the user drags a panel they open from wherever the puck currently is,
  // which keeps the widget where the eye already is instead of jumping to the
  // far side of the screen.
  const railRight = (railPos || defaultRailPos()).x + MODES.rail.width;
  const right = panelRight == null ? railRight : panelRight;
  return {
    width,
    height,
    x: clamp(right - width, area.x, area.x + area.width - width),
    y: area.y
  };
}

function placeWindow(mode) {
  if (!win || win.isDestroyed()) return;
  const bounds = targetBounds(mode);
  lastPlaced = bounds;
  win.setBounds(bounds);
}

// Called on every 'moved' event, which fires both for our own setBounds and for
// a real drag. Comparing against the last placement is what separates the two.
function rememberPosition() {
  if (!win || win.isDestroyed()) return;
  const bounds = win.getBounds();
  const ours = lastPlaced
    && bounds.x === lastPlaced.x && bounds.y === lastPlaced.y
    && bounds.width === lastPlaced.width && bounds.height === lastPlaced.height;
  if (ours) return;
  if (currentMode === 'rail') {
    railPos = { x: bounds.x, y: bounds.y };
    // The panels were opening from wherever the puck was; keep doing that from
    // its new home rather than from the corner it no longer lives in.
    panelRight = null;
  } else {
    panelRight = bounds.x + bounds.width;
  }
}

// Resize the frame first, then tell the renderer to lay out for the new size.
// This ordering is what matters: if the wider layout is applied while the
// window is still narrow, 680px of panels get squeezed into a 340px viewport
// for one frame and the task list visibly jumps sideways. Resizing first means
// the strip that Windows exposes is painted with the window background, which
// is deliberately the exact panel colour (#161922), so the widening frame just
// looks like an empty panel until the content lands.
//
// Do NOT make the window invisible across the resize (zero opacity, or hide).
// That does remove the half-painted frame, but blanking a panel that is already
// on screen is itself perceived as a flash: it reads as the panel blinking out
// and back in.
function applyMode(mode) {
  if (!win || win.isDestroyed()) return;
  placeWindow(mode);
  win.webContents.send('window-mode-applied', mode);
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
  win.on('moved', rememberPosition);
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
      applyMode(mode);
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
