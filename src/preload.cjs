const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('meiMap', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  chooseScreenshotDirectory: () => ipcRenderer.invoke('choose-screenshot-directory'),
  resetScreenshotDirectory: () => ipcRenderer.invoke('reset-screenshot-directory'),
  showMap: () => ipcRenderer.send('show-map'),
  showSettings: () => ipcRenderer.send('show-settings'),
  goCurrentLocation: () => ipcRenderer.send('go-current-location'),
  openRoute: (destination, waypoints) => ipcRenderer.send('open-route', destination, waypoints),
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  onScreenChanged: (callback) => ipcRenderer.on('screen-changed', (_event, screen) => callback(screen)),
  onMapError: (callback) => ipcRenderer.on('map-error', (_event, error) => callback(error)),
});
