const { app, BrowserWindow, WebContentsView, Notification, desktopCapturer, dialog, ipcMain, screen, shell, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SETTINGS = {
  latitude: 22.3193,
  longitude: 114.1694,
  locationLabel: '',
  accuracy: 25,
  timeOverride: '',
  batteryLevel: 76,
  avatarDataUrl: '',
  screenshotDirectory: '',
};

let mainWindow;
let mapView;
let settings;
let currentScreen = 'map';
let smokeTimer;

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    const { heading: _heading, ...savedWithoutHeading } = saved;
    return { ...DEFAULT_SETTINGS, ...savedWithoutHeading };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(next) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf8');
}

function isGoogleMapsUrl(rawUrl) {
  try {
    const hostname = new URL(rawUrl).hostname;
    return hostname === 'google.com' || hostname.endsWith('.google.com');
  } catch {
    return false;
  }
}

function layoutMap() {
  if (!mainWindow || !mapView) return;
  const [width, height] = mainWindow.getContentSize();
  mapView.setBounds({ x: 0, y: 0, width, height: height - 80 });
}

async function applyLocationOverride() {
  if (!mapView || mapView.webContents.isDestroyed()) return;
  const debug = mapView.webContents.debugger;
  try {
    if (!debug.isAttached()) debug.attach('1.3');
    await debug.sendCommand('Emulation.setGeolocationOverride', {
      latitude: settings.latitude,
      longitude: settings.longitude,
      accuracy: settings.accuracy,
    });
    await debug.sendCommand('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 5,
    });
  } catch (error) {
    console.error('Could not apply location override:', error.message);
  }
}

async function applyMapAppearance() {
  if (!mapView || mapView.webContents.isDestroyed()) return;
  try {
    await mapView.webContents.insertCSS(`
      .ml-persistent-promo-banner,
      .ml-assistive-chips,
      .P8NcLd.visible,
      .ml-my-location-fab {
        display: none !important;
      }

      #app.ml-app-container {
        top: 0 !important;
        height: 100vh !important;
      }

      #app > .Q6cQSe,
      #app > .Q6cQSe > .nwn5d,
      #app > .Q6cQSe > .nwn5d > .nwn5d,
      #app .bIrfod.nwn5d,
      #app .vMSalc.nwn5d {
        height: calc(100vh + 265px) !important;
      }

      #app > .Q6cQSe {
        top: -249px !important;
        min-height: calc(100vh + 265px) !important;
        bottom: auto !important;
      }

      .ml-branding-icon-google-logo-on-map {
        transform: translateX(0) translateY(0) !important;
      }

      #meimap-brand-label {
        position: fixed;
        z-index: 100002;
        left: 18px;
        bottom: 49px;
        color: #3c4043;
        font-family: Arial, sans-serif;
        font-size: 19px;
        font-weight: 500;
        line-height: 1;
        letter-spacing: -.35px;
        white-space: nowrap;
        pointer-events: none;
        transform: scaleX(1.08);
        transform-origin: left center;
        -webkit-text-stroke: 2px #fff;
        paint-order: stroke fill;
        text-shadow: 0 1px 1px rgba(60, 64, 67, .18);
      }

      #meimap-statusbar {
        position: fixed;
        z-index: 100003;
        top: 0;
        left: 0;
        right: 0;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px 0 18px;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #050505;
        font-size: 16px;
        font-weight: 700;
        text-shadow: 0 1px 2px rgba(255, 255, 255, .85);
      }

      #meimap-status-icons {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      #meimap-cellular {
        height: 15px;
        display: flex;
        align-items: end;
        gap: 2px;
      }

      #meimap-cellular i {
        display: block;
        width: 3px;
        border-radius: 2px;
        background: #050505;
      }

      #meimap-cellular i:nth-child(1) { height: 5px; }
      #meimap-cellular i:nth-child(2) { height: 8px; }
      #meimap-cellular i:nth-child(3) { height: 11px; }
      #meimap-cellular i:nth-child(4) { height: 14px; }

      #meimap-battery {
        width: 27px;
        height: 13px;
        overflow: visible;
      }

      #meimap-battery.low {
        color: #ff3b30;
      }

      .l1KbHe.pVMw6d {
        transform: translateY(42px) !important;
      }

      .l1KbHe .qTCCZ {
        z-index: 0 !important;
      }

      .l1KbHe button,
      .l1KbHe .JdG3E,
      .l1KbHe .NtcBjb,
      .l1KbHe .KHDVHc {
        position: absolute !important;
        z-index: 2 !important;
        opacity: 1 !important;
        visibility: visible !important;
      }

      #meimap-location-button {
        position: fixed;
        z-index: 100001;
        right: 16px;
        bottom: 20px;
        width: 52px;
        height: 52px;
        border: 0;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 5px rgba(60, 64, 67, .42);
      }

      #meimap-location-button::before,
      #meimap-location-button::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        border-radius: 50%;
      }

      #meimap-location-button::before {
        width: 19px;
        height: 19px;
        border: 3px solid #5f6368;
      }

      #meimap-location-button::after {
        width: 6px;
        height: 6px;
        background: #5f6368;
        box-shadow: 0 -13px 0 -2px #5f6368, 0 13px 0 -2px #5f6368, -13px 0 0 -2px #5f6368, 13px 0 0 -2px #5f6368;
      }

      #meimap-avatar-image {
        position: fixed;
        z-index: 100004;
        top: 54px;
        right: 16px;
        width: 38px;
        height: 38px;
        box-sizing: border-box;
        border: 2px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 0 2px #1a73e8;
        object-fit: cover;
      }

      html[data-meimap-route="true"] .l1KbHe.pVMw6d,
      html[data-meimap-route="true"] .ml-persistent-promo-banner,
      html[data-meimap-route="true"] .ml-assistive-chips,
      html[data-meimap-route="true"] .P8NcLd.visible,
      html[data-meimap-route="true"] .ml-my-location-fab {
        display: none !important;
      }

    `);

    const smokeAvatar = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#f4a261"/><circle cx="64" cy="52" r="28" fill="#264653"/><path d="M22 128c4-34 23-50 42-50s38 16 42 50" fill="#2a9d8f"/></svg>');
    const selectedAvatar = process.argv.includes('--smoke-test') ? smokeAvatar : (settings.avatarDataUrl || '');
    const avatarDataUrl = JSON.stringify(selectedAvatar);
    const currentLocationUrl = JSON.stringify(mapUrlAtLocation());
    const displayTime = JSON.stringify(settings.timeOverride || '');
    const batteryLevel = Math.max(0, Math.min(100, Number(settings.batteryLevel ?? 76)));
    const routeMode = (() => {
      try {
        return new URL(mapView.webContents.getURL()).pathname.startsWith('/maps/dir');
      } catch {
        return false;
      }
    })();
    await mapView.webContents.executeJavaScript(`(() => {
      document.querySelector('#meimap-category-row')?.remove();

      if (!window.__meiMapDismissTimer) {
        let dismissAttempts = 0;
        window.__meiMapDismissTimer = setInterval(() => {
          dismissAttempts += 1;
          const returnToWeb = [...document.querySelectorAll('button')]
            .find((button) => (button.innerText || '').trim() === '返回到网页版');
          if (returnToWeb) {
            const dialog = returnToWeb.closest('[role="dialog"]');
            const overlay = dialog?.parentElement;
            if (overlay && overlay.getBoundingClientRect().height > innerHeight * .8) {
              overlay.style.display = 'none';
            } else if (dialog) {
              dialog.style.display = 'none';
            }
            clearInterval(window.__meiMapDismissTimer);
            window.__meiMapDismissTimer = null;
          } else if (dismissAttempts >= 20) {
            clearInterval(window.__meiMapDismissTimer);
            window.__meiMapDismissTimer = null;
          }
        }, 500);
      }

      const ensureMeiMapOverlays = () => {
      let brandLabel = document.querySelector('#meimap-brand-label');
      if (!brandLabel) {
        brandLabel = document.createElement('div');
        brandLabel.id = 'meimap-brand-label';
        brandLabel.textContent = 'MeiMap';
        document.body.appendChild(brandLabel);
      }
      const googleBrand = document.querySelector('.ml-branding-icon-google-logo-on-map');
      if (googleBrand) {
        const brandRect = googleBrand.getBoundingClientRect();
        if (brandRect.width > 0 && brandRect.height > 0) {
          const brandFontSize = Math.max(16, Math.min(20, Math.round(brandRect.height * .78)));
          brandLabel.style.fontSize = brandFontSize + 'px';
          brandLabel.style.webkitTextStrokeWidth = Math.max(2, Math.round(brandFontSize * .11)) + 'px';
          brandLabel.style.left = Math.round(brandRect.left) + 'px';
          brandLabel.style.top = Math.max(0, Math.round(brandRect.top - brandLabel.getBoundingClientRect().height - 4)) + 'px';
          brandLabel.style.bottom = 'auto';
        }
      }
      if (!document.querySelector('#meimap-statusbar')) {
        const status = document.createElement('div');
        status.id = 'meimap-statusbar';
        status.innerHTML = '<span id="meimap-map-time"></span><span id="meimap-status-icons"><span id="meimap-cellular"><i></i><i></i><i></i><i></i></span><svg id="meimap-battery" viewBox="0 0 27 13" aria-hidden="true"><rect x=".7" y=".7" width="23" height="11.6" rx="3.1" fill="none" stroke="currentColor" stroke-width="1.4"/><rect id="meimap-battery-fill" x="2.5" y="2.5" width="17.5" height="8" rx="1.8" fill="currentColor"/><path d="M25 4.1c.8.4 1.25 1.1 1.25 2.4S25.8 8.5 25 8.9V4.1Z" fill="currentColor" opacity=".42"/></svg></span>';
        document.body.appendChild(status);
        const updateTime = () => {
          const value = window.__meiMapDisplayTime || new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
          const time = document.querySelector('#meimap-map-time');
          if (time) time.textContent = value;
        };
        window.__meiMapUpdateTime = updateTime;
        window.__meiMapDisplayTime = ${displayTime};
        updateTime();
        if (!window.__meiMapClockTimer) window.__meiMapClockTimer = setInterval(() => window.__meiMapUpdateTime?.(), 30000);
      }
      window.__meiMapDisplayTime = ${displayTime};
      window.__meiMapUpdateTime?.();
      const shownBatteryLevel = ${batteryLevel};
      const battery = document.querySelector('#meimap-battery');
      const batteryFill = document.querySelector('#meimap-battery-fill');
      if (battery && batteryFill) {
        batteryFill.setAttribute('width', String(19.5 * shownBatteryLevel / 100));
        battery.classList.toggle('low', shownBatteryLevel <= 20);
      }

      const isRouteMode = ${routeMode};
      document.documentElement.dataset.meimapRoute = isRouteMode ? 'true' : 'false';
      const hideRouteElement = (node) => {
        let current = node;
        for (let depth = 0; current && current !== document.body && depth < 8; depth += 1, current = current.parentElement) {
          const rect = current.getBoundingClientRect();
          const style = getComputedStyle(current);
          const positioned = style.position === 'fixed' || style.position === 'absolute';
          if (positioned && rect.width > innerWidth * .55 && rect.height > 36 && rect.height < innerHeight * .72) {
            current.style.setProperty('display', 'none', 'important');
            return;
          }
        }
      };
      const hideRouteChrome = () => {
        if (!isRouteMode) return;
        const patterns = [
          /切换到应用|在应用中打开|获取实时路况|路线选项|到达时间|open in app|get real-time traffic|directions options/i,
          /^开始$|^start$/i,
          /^驾车$|^步行$|^公交$|^骑行$|^driving$|^walking$|^transit$|^bicycling$/i,
          /\b\d+\s*min\b|\d+\s*分钟/
        ];
        document.querySelectorAll('button,[role="button"],input,[aria-label],p,span,div').forEach((node) => {
          const text = ((node.getAttribute('aria-label') || '') + ' ' + (node.innerText || '') + ' ' + (node.value || '')).trim();
          if (text && patterns.some((pattern) => pattern.test(text))) hideRouteElement(node);
        });
        document.querySelectorAll('input').forEach((input) => {
          const rect = input.getBoundingClientRect();
          if (rect.top < 210 && rect.width > 180) hideRouteElement(input);
        });
        window.dispatchEvent(new Event('resize'));
      };
      if (isRouteMode) {
        hideRouteChrome();
        if (!window.__meiMapRouteObserver) {
          let routeHideTimer;
          window.__meiMapRouteObserver = new MutationObserver(() => {
            clearTimeout(routeHideTimer);
            routeHideTimer = setTimeout(hideRouteChrome, 80);
          });
          window.__meiMapRouteObserver.observe(document.body, { childList: true, subtree: true });
        }
        setTimeout(hideRouteChrome, 500);
      } else {
        document.documentElement.dataset.meimapRoute = 'false';
      }

      if (!document.querySelector('#meimap-location-button')) {
        const locationButton = document.createElement('button');
        locationButton.id = 'meimap-location-button';
        locationButton.type = 'button';
        locationButton.setAttribute('aria-label', '当前位置');
        locationButton.addEventListener('click', () => location.assign(${currentLocationUrl}));
        document.body.appendChild(locationButton);
      }

      const image = ${avatarDataUrl};
      let customAvatar = document.querySelector('#meimap-avatar-image');
      if (image) {
        if (!customAvatar) {
          customAvatar = document.createElement('img');
          customAvatar.id = 'meimap-avatar-image';
          customAvatar.alt = '自定义头像';
          document.body.appendChild(customAvatar);
        }
        customAvatar.src = image;
      } else {
        customAvatar?.remove();
      }
      };

      ensureMeiMapOverlays();
      if (!window.__meiMapOverlayTimer) {
        window.__meiMapOverlayTimer = setInterval(ensureMeiMapOverlays, 1000);
      }
    })()`);
  } catch (error) {
    console.error('Could not apply map appearance:', error.message);
  }
}

async function runSmokeCapture() {
  if (!process.argv.includes('--smoke-test')) return;
  if (smokeTimer) clearTimeout(smokeTimer);
  smokeTimer = setTimeout(async () => {
    try {
      const outputDir = app.getAppPath();
      let shellImage = await mainWindow.webContents.capturePage();
      let mapImage = await mapView.webContents.capturePage();
      if (shellImage.isEmpty() || mapImage.isEmpty()) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        shellImage = await mainWindow.webContents.capturePage();
        mapImage = await mapView.webContents.capturePage();
      }
      fs.writeFileSync(path.join(outputDir, 'smoke-shell.png'), shellImage.toPNG());
      fs.writeFileSync(path.join(outputDir, 'smoke-map.png'), mapImage.toPNG());
      const windowSources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 645, height: 1320 },
      });
      const meiMapSource = windowSources.find((source) => source.name === 'MeiMap');
      if (meiMapSource && !meiMapSource.thumbnail.isEmpty()) {
        fs.writeFileSync(path.join(outputDir, 'smoke-window.png'), meiMapSource.thumbnail.toPNG());
      }
      console.log('SMOKE_OK', mapView.webContents.getURL());
    } catch (error) {
      console.error('SMOKE_FAILED', error);
      process.exitCode = 1;
    } finally {
      app.quit();
    }
  }, 22000);
}

async function captureCurrentPage() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  const scaleFactor = screen.getDisplayMatching(bounds).scaleFactor || 1;
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: {
      width: Math.round(bounds.width * scaleFactor),
      height: Math.round(bounds.height * scaleFactor),
    },
  });
  const windowTitle = mainWindow.getTitle();
  const source = sources.find((item) => item.name === windowTitle)
    || sources.find((item) => item.name.includes('MeiMap'));
  if (!source || source.thumbnail.isEmpty()) throw new Error('无法捕获 MeiMap 窗口');

  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const fileName = `MeiMap-${stamp}.png`;
  const configuredDirectory = settings.screenshotDirectory || '';
  const outputDirectory = configuredDirectory && fs.existsSync(configuredDirectory)
    ? configuredDirectory
    : app.getPath('desktop');
  fs.writeFileSync(path.join(outputDirectory, fileName), source.thumbnail.toPNG());
  if (Notification.isSupported()) {
    new Notification({ title: 'MeiMap 截图已保存', body: path.join(outputDirectory, fileName) }).show();
  }
}

function setScreen(screenName) {
  currentScreen = screenName;
  mapView.setVisible(screenName === 'map');
  mainWindow.webContents.send('screen-changed', screenName);
}

function mapUrlAtLocation() {
  const { latitude, longitude } = settings;
  return `https://www.google.com/maps/@${latitude},${longitude},16z?hl=zh-CN`;
}

function parseCoordinateInput(value) {
  const match = String(value || '').match(/^\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*[,，]\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

async function resolveLocationInput(value) {
  const input = String(value || '').trim();
  if (!input) throw new Error('请输入地点、地址或坐标');
  const coordinates = parseCoordinateInput(input);
  if (coordinates) return coordinates;

  const resolverWindow = new BrowserWindow({
    show: false,
    width: 480,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  resolverWindow.webContents.setUserAgent(mapView.webContents.getUserAgent());

  try {
    const searchUrl = new URL('https://www.google.com/maps/search/');
    searchUrl.searchParams.set('api', '1');
    searchUrl.searchParams.set('query', input);
    searchUrl.searchParams.set('hl', 'zh-CN');
    await resolverWindow.loadURL(searchUrl.toString());

    const deadline = Date.now() + 15000;
    let fallbackCoordinates = null;
    while (Date.now() < deadline) {
      const currentUrl = resolverWindow.webContents.getURL();
      const placeMatch = currentUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
      if (placeMatch) {
        return { latitude: Number(placeMatch[1]), longitude: Number(placeMatch[2]) };
      }
      const alternatePlaceMatch = currentUrl.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
      if (alternatePlaceMatch) {
        return { latitude: Number(alternatePlaceMatch[2]), longitude: Number(alternatePlaceMatch[1]) };
      }
      const centerMatch = currentUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
      if (centerMatch) {
        fallbackCoordinates = { latitude: Number(centerMatch[1]), longitude: Number(centerMatch[2]) };
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    if (fallbackCoordinates) return fallbackCoordinates;
    throw new Error('未找到该位置，请输入更完整的地点或“纬度, 经度”');
  } finally {
    if (!resolverWindow.isDestroyed()) resolverWindow.destroy();
  }
}

function mapRouteUrl(destination, waypoints) {
  const origin = `${settings.latitude},${settings.longitude}`;
  const stops = [origin, ...waypoints, destination].map((value) => encodeURIComponent(value));
  const url = new URL(`https://www.google.com/maps/dir/${stops.join('/')}/`);
  url.searchParams.set('travelmode', 'driving');
  url.searchParams.set('hl', 'zh-CN');
  return url.toString();
}


function createWindow() {
  settings = loadSettings();

  mainWindow = new BrowserWindow({
    width: 430,
    height: 880,
    minWidth: 390,
    minHeight: 720,
    maxWidth: 520,
    title: 'MeiMap',
    frame: false,
    roundedCorners: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mapView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.contentView.addChildView(mapView);
  layoutMap();

  const mobileUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
  mapView.webContents.setUserAgent(mobileUserAgent);

  mapView.webContents.setWindowOpenHandler(({ url }) => {
    if (isGoogleMapsUrl(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mapView.webContents.on('will-navigate', (event, url) => {
    if (!isGoogleMapsUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mapView.webContents.on('did-finish-load', async () => {
    await applyLocationOverride();
    await applyMapAppearance();
    await runSmokeCapture();
  });
  mapView.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) mainWindow.webContents.send('map-error', { code, description, url });
  });

  mainWindow.on('resize', layoutMap);
  mainWindow.on('closed', () => {
    mainWindow = undefined;
    mapView = undefined;
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mapView.webContents.loadURL(mapUrlAtLocation());
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'geolocation' && webContents === mapView?.webContents);
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());

ipcMain.handle('get-settings', () => ({ ...settings }));

ipcMain.handle('save-location-input', async (_event, value) => {
  const input = String(value || '').trim();
  const resolved = await resolveLocationInput(input);
  settings = { ...settings, ...resolved, locationLabel: input };
  saveSettings(settings);
  await applyLocationOverride();
  await mapView.webContents.loadURL(mapUrlAtLocation());
  return { ...settings };
});

ipcMain.handle('choose-screenshot-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择截图保存位置',
    defaultPath: settings.screenshotDirectory || app.getPath('desktop'),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  settings = { ...settings, screenshotDirectory: result.filePaths[0] };
  saveSettings(settings);
  return settings.screenshotDirectory;
});

ipcMain.handle('reset-screenshot-directory', () => {
  settings = { ...settings, screenshotDirectory: '' };
  saveSettings(settings);
  return '';
});

ipcMain.handle('save-settings', async (_event, payload) => {
  const latitude = payload.latitude == null ? settings.latitude : Number(payload.latitude);
  const longitude = payload.longitude == null ? settings.longitude : Number(payload.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('纬度必须在 -90 到 90 之间');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('经度必须在 -180 到 180 之间');
  }

  const timeOverride = payload.timeOverride == null ? settings.timeOverride : String(payload.timeOverride);
  if (timeOverride && !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeOverride)) {
    throw new Error('显示时间格式无效');
  }

  const batteryLevel = payload.batteryLevel == null ? settings.batteryLevel : Number(payload.batteryLevel);
  if (!Number.isFinite(batteryLevel) || batteryLevel < 0 || batteryLevel > 100) {
    throw new Error('显示电量必须在 0 到 100 之间');
  }

  let avatarDataUrl = settings.avatarDataUrl || '';
  if (typeof payload.avatarDataUrl === 'string') {
    if (payload.avatarDataUrl && !payload.avatarDataUrl.startsWith('data:image/')) {
      throw new Error('头像文件格式无效');
    }
    if (payload.avatarDataUrl.length > 750_000) {
      throw new Error('头像文件太大');
    }
    avatarDataUrl = payload.avatarDataUrl;
  }

  settings = { ...settings, latitude, longitude, timeOverride, batteryLevel: Math.round(batteryLevel), avatarDataUrl };
  saveSettings(settings);
  await applyLocationOverride();
  await applyMapAppearance();
  return { ...settings };
});

ipcMain.on('show-map', () => setScreen('map'));
ipcMain.on('show-settings', () => setScreen('settings'));

ipcMain.on('go-current-location', async () => {
  setScreen('map');
  await applyLocationOverride();
  mapView.webContents.loadURL(mapUrlAtLocation());
});

ipcMain.on('open-route', (_event, destination, waypoints) => {
  const trimmed = String(destination || '').trim();
  if (!trimmed) return;
  const normalizedWaypoints = Array.isArray(waypoints)
    ? waypoints.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 9)
    : [];
  setScreen('map');
  mapView.webContents.loadURL(mapRouteUrl(trimmed, normalizedWaypoints));
});

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-close', () => mainWindow?.close());

app.on('web-contents-created', (_event, contents) => {
  contents.on('before-input-event', (event, input) => {
    if (!input.control) return;
    if (input.shift && input.key.toLowerCase() === 's') {
      event.preventDefault();
      captureCurrentPage().catch((error) => console.error('Screenshot failed:', error));
      return;
    }
    if (input.key.toLowerCase() === 'q') {
      event.preventDefault();
      mainWindow?.close();
    }
    if (input.key.toLowerCase() === 'm') {
      event.preventDefault();
      mainWindow?.minimize();
    }
  });
});
