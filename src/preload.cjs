const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('meiMap', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  onOpenPanel: (callback) => ipcRenderer.on('open-panel', (_event, name) => callback(name)),
  setDisplayMode: (mode) => ipcRenderer.invoke('set-display-mode', mode),
  onDisplayModeChanged: (callback) => ipcRenderer.on('display-mode-changed', (_event, mode) => callback(mode)),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  saveLocationInput: (value) => ipcRenderer.invoke('save-location-input', value),
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
