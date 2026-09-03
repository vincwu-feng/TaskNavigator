const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tasknav', {
  setWindowMode: mode => ipcRenderer.send('window-mode', mode),
  onWindowModeApplied: cb => ipcRenderer.on('window-mode-applied', (_e, mode) => cb(mode)),
  setIgnoreMouse: ignore => ipcRenderer.send('set-ignore-mouse', !!ignore),
  hideWindow: () => ipcRenderer.send('window-hide'),
  copyText: text => ipcRenderer.send('copy-text', String(text || '')),
  openCodexThread: threadId => ipcRenderer.invoke('open-codex-thread', String(threadId || '')),
  openClaudeSession: cwd => ipcRenderer.invoke('open-claude-session', String(cwd || '')),
  daemonUrl: 'http://127.0.0.1:48763'
});
