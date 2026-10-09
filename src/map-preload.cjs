const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('meiMapControls', {
  openPanel: (name) => {
    if (['settings', 'route', 'avatar'].includes(name)) ipcRenderer.send('open-panel-from-map', name);
  },
});
