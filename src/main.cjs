const { app, BrowserWindow, WebContentsView, Notification, desktopCapturer, dialog, ipcMain, screen, shell, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

if (process.argv.includes('--smoke-test')) {
  app.setPath('userData', path.join(app.getPath('temp'), 'MeiMap-smoke-' + process.pid));
}

const DEFAULT_SETTINGS = {
  latitude: 22.3193,
  longitude: 114.1694,
  locationLabel: '',
  accuracy: 25,
  timeOverride: '',
  batteryLevel: 76,
  avatarDataUrl: '',
  screenshotDirectory: '',
  displayMode: 'phone',
};

let mainWindow;
let mapView;
let settings;
let currentScreen = 'map';
let smokeTimer;
let smokeRunning = false;
let lastGeocodeRequestAt = 0;

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
  const duo = settings.displayMode === 'duo';
  mapView.setBounds({ x: 0, y: 0, width, height: duo ? height : height - 80 });
}

function applyDisplayMode() {
  const duo = settings.displayMode === 'duo';
  mainWindow.setMinimumSize(duo ? 710 : 390, duo ? 500 : 720);
  mainWindow.setMaximumSize(duo ? 1400 : 520, 1600);
  const work = screen.getDisplayMatching(mainWindow.getBounds()).workArea;
  mainWindow.setSize(duo ? 890 : 430, duo ? 626 : 880);
  const bounds = mainWindow.getBounds();
  mainWindow.setPosition(Math.max(work.x, Math.min(bounds.x, work.x + work.width - bounds.width)),
    Math.max(work.y, Math.min(bounds.y, work.y + work.height - bounds.height)));
  layoutMap();
  mainWindow.webContents.send('display-mode-changed', settings.displayMode);
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

      html[data-meimap-display="duo"] #meimap-statusbar {
        left: auto; right: 12px; top: 16px; width: 66px; height: auto;
        padding: 0; flex-direction: column; gap: 8px; font-size: 15px;
      }
      html[data-meimap-display="duo"] #meimap-status-icons { gap: 5px; }
      #meimap-duo-status { display: none; }
      html[data-meimap-display="duo"] #meimap-duo-status { display: block; }
      html[data-meimap-display="duo"] #meimap-duo-status svg { display: block; width: 36px; height: 36px; }
      html[data-meimap-display="duo"] #meimap-status-icons { display: none; }
      html[data-meimap-display="duo"] #meimap-map-time { order: 0; }
      html[data-meimap-display="duo"] #meimap-duo-status { order: 1; }
      html[data-meimap-display="duo"] #meimap-location-button { right: 96px; }
      #meimap-duo-nav {
        position: fixed; right: 12px; bottom: 20px; width: 66px;
        z-index: 100005; display: grid; padding: 8px 4px;
        border-radius: 34px; background: rgba(248, 248, 250, .72);
        backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
        box-shadow: 0 2px 12px rgba(35, 45, 55, .16), inset 0 0 0 1px rgba(255,255,255,.7);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #meimap-duo-nav button {
        height: 60px; padding: 4px 0; border: 0; background: transparent;
        color: #5f6368; font: inherit; font-size: 11px; cursor: pointer;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
      }
      #meimap-duo-nav .tab-icon { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      #meimap-duo-nav button.active { color: #007aff; }
      #meimap-duo-nav .active-pill { width: 46px; height: 30px; border-radius: 18px; display: grid; place-items: center; }
      #meimap-duo-nav button.active { border-radius: 24px; background: rgba(199,237,255,.8); }
      #meimap-duo-nav button.active .tab-icon { fill: currentColor; }
      html[data-meimap-display="duo"] #app > .Q6cQSe {
        left: 0 !important;
        right: 0 !important;
        transform: none !important;
        width: 100% !important;
        max-width: none !important;
        max-height: none !important;
      }
      html[data-meimap-display="duo"] .l1KbHe.pVMw6d {
        background: transparent !important;
        box-shadow: none !important;
        width: 400px !important;
        max-width: calc(100vw - 100px) !important;
        transform: translateY(12px) !important;
      }
      html[data-meimap-display="duo"] .l1KbHe .bVzuaf {
        background: transparent !important;
      }
      html[data-meimap-display="duo"] #meimap-avatar-image {
        top: 24px;
        right: auto;
        left: 350px;
      }

      html[data-meimap-route="true"] .l1KbHe.pVMw6d,
      html[data-meimap-route="true"] .ml-directions-searchbox-parent,
      html[data-meimap-route="true"] .ml-pane-container,
      html[data-meimap-route="true"] .ml-route-options-picker-container,
      html[data-meimap-route="true"] .ml-directions-more-options-container,
      html[data-meimap-route="true"] .FovMle,
      html[data-meimap-route="true"] #meimap-avatar-image,
      html[data-meimap-route="true"] .ml-persistent-promo-banner,
      html[data-meimap-route="true"] .ml-assistive-chips,
      html[data-meimap-route="true"] .P8NcLd.visible,
      html[data-meimap-route="true"] .ml-my-location-fab {
        display: none !important;
      }

      html[data-meimap-route="true"] #app > .Q6cQSe {
        display: block !important;
        left: 0 !important; right: 0 !important; width: 100% !important;
        top: 0 !important; height: 100vh !important; min-height: 100vh !important;
        max-width: none !important; max-height: none !important; transform: none !important;
      }
      html[data-meimap-route="true"] #app .bIrfod.nwn5d,
      html[data-meimap-route="true"] #app .vMSalc.nwn5d,
      html[data-meimap-route="true"] #app > .Q6cQSe .nwn5d {
        height: 100% !important;
      }

    `, { cssOrigin: 'author' });

    const smokeAvatar = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#f4a261"/><circle cx="64" cy="52" r="28" fill="#264653"/><path d="M22 128c4-34 23-50 42-50s38 16 42 50" fill="#2a9d8f"/></svg>');
    const selectedAvatar = process.argv.includes('--smoke-test') ? smokeAvatar : (settings.avatarDataUrl || '');
    const avatarDataUrl = JSON.stringify(selectedAvatar);
    const currentLocationUrl = JSON.stringify(mapUrlAtLocation());
    const displayTime = JSON.stringify(settings.timeOverride || '');
    const duoStatusMarkup = JSON.stringify(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').match(/<svg class="duo-status"[\s\S]*?<\/svg>/)[0]);
    const navigationMarkup = JSON.stringify(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').match(/<nav class="tabbar"[^>]*>([\s\S]*?)<\/nav>/)[1]);
    const batteryLevel = Math.max(0, Math.min(100, Number(settings.batteryLevel ?? 76)));
    const routeMode = (() => {
      try {
        return new URL(mapView.webContents.getURL()).pathname.startsWith('/maps/dir');
      } catch {
        return false;
      }
    })();
    await mapView.webContents.executeJavaScript(`(() => {
      document.documentElement.dataset.meimapDisplay = ${JSON.stringify(settings.displayMode)};
      window.dispatchEvent(new Event('resize'));
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
      let duoNav = document.querySelector('#meimap-duo-nav');
      if (document.documentElement.dataset.meimapDisplay === 'duo') {
        if (!duoNav) {
          duoNav = document.createElement('nav');
          duoNav.id = 'meimap-duo-nav';
          duoNav.setAttribute('aria-label', '主导航');
          duoNav.innerHTML = ${navigationMarkup};
          duoNav.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            const panel = { 'tab-settings': 'settings', 'tab-route': 'route', 'tab-avatar': 'avatar' }[button?.id];
            if (panel) window.meiMapControls.openPanel(panel);
          });
          document.body.appendChild(duoNav);
        }
        duoNav.querySelector('#tab-map').classList.toggle('active', !${routeMode});
        duoNav.querySelector('#tab-route').classList.toggle('active', ${routeMode});
      } else {
        duoNav?.remove();
      }

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
      let duoStatus = document.querySelector('#meimap-duo-status');
      if (!duoStatus) {
        duoStatus = document.createElement('span');
        duoStatus.id = 'meimap-duo-status';
        duoStatus.innerHTML = ${duoStatusMarkup};
        document.querySelector('#meimap-statusbar').appendChild(duoStatus);
      }
      const duoBattery = duoStatus.querySelector('.duo-battery-level');
      duoBattery.setAttribute('stroke-dasharray', shownBatteryLevel + ' 100');
      duoBattery.style.color = shownBatteryLevel <= 20 ? '#ff3b30' : '';
      const battery = document.querySelector('#meimap-battery');
      const batteryFill = document.querySelector('#meimap-battery-fill');
      if (battery && batteryFill) {
        batteryFill.setAttribute('width', String(19.5 * shownBatteryLevel / 100));
        battery.classList.toggle('low', shownBatteryLevel <= 20);
      }

      const isRouteMode = ${routeMode};
      document.documentElement.dataset.meimapRoute = isRouteMode ? 'true' : 'false';
      const hideRouteElement = (node) => {
        if (node.closest('[id^="meimap-"]')) return;
        if (node.matches('button,[role="button"],input')) node.style.setProperty('display', 'none', 'important');
        if (node.closest('.Q6cQSe')) return;
        let current = node;
        for (let depth = 0; current && current !== document.body && depth < 8; depth += 1, current = current.parentElement) {
          const rect = current.getBoundingClientRect();
          const style = getComputedStyle(current);
          const positioned = style.position === 'fixed' || style.position === 'absolute';
          if (current.matches('#app,.Q6cQSe,.bIrfod,.vMSalc,canvas') || current.querySelector('canvas,.bIrfod,.vMSalc')
            || current.closest('#meimap-duo-nav,#meimap-statusbar')) continue;
          const bottomPanel = rect.width > innerWidth * .55 && rect.height > 36 && rect.height < innerHeight * .72;
          if (positioned && bottomPanel) {
            current.style.setProperty('display', 'none', 'important');
            return;
          }
        }
      };
      const hideRouteChrome = () => {
        if (!isRouteMode) return;
        document.querySelectorAll('.FovMle').forEach((card) => {
          for (let overlay = card.parentElement; overlay && overlay !== document.body; overlay = overlay.parentElement) {
            if (overlay.matches('#app,.Q6cQSe') || overlay.querySelector('canvas,.bIrfod,.vMSalc')) break;
            const r = overlay.getBoundingClientRect();
            const position = getComputedStyle(overlay).position;
            if (overlay.getAttribute('role') === 'dialog' || (['fixed', 'absolute'].includes(position) && r.width > innerWidth * .8 && r.height > innerHeight * .8)) {
              overlay.style.setProperty('display', 'none', 'important');
              break;
            }
          }
        });
        document.querySelectorAll('.ml-directions-searchbox-parent,.ml-pane-container,.ml-route-options-picker-container,.ml-directions-more-options-container,.FovMle').forEach((panel) => panel.style.setProperty('display', 'none', 'important'));
        const map = document.querySelector('#app > .Q6cQSe');
        if (map) {
          for (const [property, value] of Object.entries({ display: 'block', transition: 'none', animation: 'none', transform: 'none', left: '0px', right: '0px', width: '100%', 'max-width': 'none', 'max-height': 'none' })) {
            map.style.setProperty(property, value, 'important');
          }
        }
        const patterns = [
          /切换到应用|在应用中打开|获取实时路况|路线选项|到达时间|open in app|get real-time traffic|directions options/i,
          /^开始$|^start$/i,
          /^驾车$|^步行$|^公交$|^骑行$|^driving$|^walking$|^transit$|^bicycling$/i,
          /[0-9]+[ ]*(分钟|小时|天|minutes?|mins?|hours?|hrs?|days?)/i
        ];
        document.querySelectorAll('button,[role="button"],input,[aria-label],p,span,div').forEach((node) => {
          const text = ((node.getAttribute('aria-label') || '') + ' ' + (node.innerText || '') + ' ' + (node.value || '')).trim();
          if (text && patterns.some((pattern) => pattern.test(text))) hideRouteElement(node);
        });
        document.querySelectorAll('input').forEach((input) => {
          const rect = input.getBoundingClientRect();
          if (rect.top < 210 && rect.width > 180) hideRouteElement(input);
        });
      };
      if (isRouteMode) {
        hideRouteChrome();
        window.__meiMapHideRouteChrome = hideRouteChrome;
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
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      clearInterval(window.__meiMapOverlayTimer);
      window.__meiMapOverlayTimer = setInterval(() => {
        ensureMeiMapOverlays();
        if (${routeMode}) window.__meiMapHideRouteChrome?.();
      }, 1000);
    })()`);
  } catch (error) {
    console.error('Could not apply map appearance:', error.message);
  }
}

async function runSmokeCapture() {
  if (!process.argv.includes('--smoke-test')) return;
  if (smokeRunning) return;
  if (smokeTimer) clearTimeout(smokeTimer);
  smokeTimer = setTimeout(async () => {
    smokeRunning = true;
    try {
      const outputDir = app.getAppPath();
      if (process.argv.includes('--smoke-route')) {
        for (const mode of [settings.displayMode]) {
          await applyMapAppearance();
          await new Promise((resolve) => setTimeout(resolve, 5000));
          const routeLayout = await mapView.webContents.executeJavaScript(`(() => {
            const visible = el => {
              if (!el) return false;
              const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
              return r.width > 2 && r.height > 2 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight
                && s.visibility !== 'hidden' && s.opacity !== '0' && s.clip !== 'rect(0px, 0px, 0px, 0px)';
            };
            const map = document.querySelector('#app > .Q6cQSe').getBoundingClientRect();
            const panels = [...document.querySelectorAll('.ml-directions-searchbox-parent,.ml-pane-container,.ml-route-options-picker-container,.ml-directions-more-options-container,.FovMle')];
            const residual = [...document.querySelectorAll('button,input,span,p')].filter(el => {
              if (!visible(el) || el.closest('[id^="meimap-"]')) return false;
              return /到达时间|切换到应用|在应用中打开|获取实时路况|^[ ]*开始[ ]*$|[0-9]+[ ]*(分钟|小时|天|minutes?|mins?|hours?|hrs?|days?)/i.test((el.innerText || '') + (el.getAttribute('aria-label') || ''));
            }).map(el => (el.innerText || el.getAttribute('aria-label') || '').slice(0,60));
            const mapElement = document.querySelector('#app > .Q6cQSe');
            return {dataset:{...document.documentElement.dataset},transform:getComputedStyle(mapElement).transform,left:getComputedStyle(mapElement).left,translate:getComputedStyle(mapElement).translate,mapLeft:map.left, mapWidth:map.width, width:innerWidth, visiblePanels:panels.filter(visible).length, residual,
              mapVisible:visible(document.querySelector('.vMSalc')), brandingVisible:visible(document.querySelector('.ml-branding-icon-google-logo-on-map'))};
          })()`);
          if (routeLayout.visiblePanels || routeLayout.residual.length || !routeLayout.mapVisible || Math.abs(routeLayout.mapLeft) > 1
            || Math.abs(routeLayout.mapWidth - routeLayout.width) > 1) throw new Error('Route check failed: ' + mode + ' ' + JSON.stringify(routeLayout));
          const routeImage = await captureWindowImage();
          const bitmap = routeImage.toBitmap();
          let routePixels = 0;
          for (let i = 0; i < bitmap.length; i += 4) {
            if (bitmap[i] > 120 && bitmap[i + 1] < 100 && bitmap[i + 2] < 100) routePixels += 1;
          }
          fs.writeFileSync(path.join(outputDir, 'smoke-route-' + mode + '.png'), routeImage.toPNG());
          if (routePixels < 30) throw new Error('Route line not rendered: ' + mode + ' ' + JSON.stringify(routeImage.getSize()));
          console.log('ROUTE_CHECK_OK', mode, JSON.stringify(routeLayout));
        }
      }
      if (process.argv.includes('--smoke-duo') && !process.argv.includes('--smoke-route')) {
        const layout = await mapView.webContents.executeJavaScript(`(() => {
          const nav = document.querySelector('#meimap-duo-nav');
          const map = document.querySelector('#app > .Q6cQSe').getBoundingClientRect();
          return { buttons: nav?.querySelectorAll('button').length, mapLeft: map.left, mapWidth: map.width,
            width: innerWidth, statusBackground: getComputedStyle(document.querySelector('#meimap-statusbar')).backgroundColor,
            searchBackdrop: getComputedStyle(document.querySelector('.l1KbHe .bVzuaf')).backgroundColor,
            searchBackground: getComputedStyle(document.querySelector('.l1KbHe .qTCCZ')).backgroundColor };
        })()`);
        if (layout.buttons !== 4 || layout.mapLeft !== 0 || Math.abs(layout.mapWidth - layout.width) > 1
          || layout.statusBackground !== 'rgba(0, 0, 0, 0)' || layout.searchBackdrop !== 'rgba(0, 0, 0, 0)'
          || layout.searchBackground !== 'rgb(255, 255, 255)') throw new Error('Duo layout check failed: ' + JSON.stringify(layout));
        await mapView.webContents.executeJavaScript("document.querySelector('#meimap-duo-nav #tab-settings').click()");
        await new Promise((resolve) => setTimeout(resolve, 400));
        const panelOpened = await mainWindow.webContents.executeJavaScript("!document.querySelector('#settings-screen').classList.contains('hidden')");
        if (!panelOpened || currentScreen === 'map') throw new Error('Floating navigation did not open Saved');
        await mainWindow.webContents.executeJavaScript("document.querySelector('#settings-back').click()");
        await new Promise((resolve) => setTimeout(resolve, 1800));
        console.log('DUO_CHECK_OK', JSON.stringify(layout));
      }
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
        thumbnailSize: {
          width: Math.round(mainWindow.getBounds().width * screen.getDisplayMatching(mainWindow.getBounds()).scaleFactor),
          height: Math.round(mainWindow.getBounds().height * screen.getDisplayMatching(mainWindow.getBounds()).scaleFactor),
        },
      });
      const meiMapSource = windowSources.find((source) => source.id === mainWindow.getMediaSourceId());
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

function geocodeCachePath() {
  return path.join(app.getPath('userData'), 'geocode-cache.json');
}

function loadGeocodeCache() {
  try {
    return JSON.parse(fs.readFileSync(geocodeCachePath(), 'utf8'));
  } catch {
    return {};
  }
}

function saveGeocodeCache(cache) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(geocodeCachePath(), JSON.stringify(cache, null, 2), 'utf8');
}

async function captureWindowImage() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  const scaleFactor = screen.getDisplayMatching(bounds).scaleFactor || 1;
  const sourceId = mainWindow.getMediaSourceId().split(':').slice(0, 2).join(':');
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: {
      width: Math.round(bounds.width * scaleFactor),
      height: Math.round(bounds.height * scaleFactor),
    },
  });
  const source = sources.find((item) => item.id.split(':').slice(0, 2).join(':') === sourceId)
    || (process.argv.includes('--smoke-test') ? sources.find((item) => item.name === 'MeiMap Test ' + process.pid) : null);
  if (!source || source.thumbnail.isEmpty()) throw new Error('无法捕获 MeiMap 窗口');
  return source.thumbnail;
}

async function captureCurrentPage() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const screenshot = await captureWindowImage();

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
  fs.writeFileSync(path.join(outputDirectory, fileName), screenshot.toPNG());
  if (Notification.isSupported()) {
    new Notification({ title: 'MeiMap 截图已保存', body: path.join(outputDirectory, fileName) }).show();
  }
}

function setScreen(screenName) {
  currentScreen = screenName;
  mapView.setVisible(screenName === 'map');
  mainWindow.webContents.send('screen-changed', screenName);
  if (screenName === 'map') {
    mapView.webContents.executeJavaScript("window.dispatchEvent(new Event('resize'))").catch(() => {});
  }
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

  const cacheKey = input.toLocaleLowerCase('zh-CN');
  const cache = loadGeocodeCache();
  const cached = cache[cacheKey];
  if (cached && Number.isFinite(cached.latitude) && Number.isFinite(cached.longitude)) {
    return { latitude: cached.latitude, longitude: cached.longitude };
  }

  const waitTime = Math.max(0, 1000 - (Date.now() - lastGeocodeRequestAt));
  if (waitTime) await new Promise((resolve) => setTimeout(resolve, waitTime));
  lastGeocodeRequestAt = Date.now();

  const endpoint = process.env.MEIMAP_GEOCODER_URL || 'https://nominatim.openstreetmap.org/search';
  const searchUrl = new URL(endpoint);
  searchUrl.searchParams.set('q', input);
  searchUrl.searchParams.set('format', 'jsonv2');
  searchUrl.searchParams.set('limit', '1');
  searchUrl.searchParams.set('accept-language', 'zh-CN');
  const response = await fetch(searchUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'MeiMap/0.1.0 (personal desktop app; https://github.com/meistingray/MeiMap)',
    },
  });
  if (!response.ok) throw new Error(`地点搜索暂时不可用（${response.status}）`);
  const results = await response.json();
  const result = Array.isArray(results) ? results[0] : null;
  const latitude = Number(result?.lat);
  const longitude = Number(result?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('未找到该位置，请输入更完整的地点或“纬度, 经度”');
  }
  cache[cacheKey] = { latitude, longitude };
  saveGeocodeCache(cache);
  return { latitude, longitude };
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
  settings.displayMode = settings.displayMode === 'duo' ? 'duo' : 'phone';
  if (process.argv.includes('--smoke-duo')) settings.displayMode = 'duo';
  if (process.argv.includes('--smoke-phone')) settings.displayMode = 'phone';
  if (process.argv.includes('--smoke-short-route')) {
    settings.latitude = 31.2400;
    settings.longitude = 121.4700;
  } else if (process.argv.includes('--smoke-route')) {
    settings.latitude = 45.7164315;
    settings.longitude = 126.7546573;
  }

  mainWindow = new BrowserWindow({
    width: settings.displayMode === 'duo' ? 890 : 430,
    height: settings.displayMode === 'duo' ? 626 : 880,
    minWidth: settings.displayMode === 'duo' ? 710 : 390,
    minHeight: settings.displayMode === 'duo' ? 500 : 720,
    maxWidth: settings.displayMode === 'duo' ? 1400 : 520,
    title: process.argv.includes('--smoke-test') ? 'MeiMap Test ' + process.pid : 'MeiMap',
    frame: false,
    roundedCorners: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      backgroundThrottling: !process.argv.includes('--smoke-test'),
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mapView = new WebContentsView({
    webPreferences: {
      backgroundThrottling: !process.argv.includes('--smoke-test'),
      preload: path.join(__dirname, 'map-preload.cjs'),
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
  if (process.argv.includes('--smoke-test')) mainWindow.on('page-title-updated', (event) => event.preventDefault());
  mainWindow.on('closed', () => {
    mainWindow = undefined;
    mapView = undefined;
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mapView.webContents.loadURL(process.argv.includes('--smoke-route')
    ? (process.argv.includes('--smoke-short-route') ? mapRouteUrl('31.2304,121.4737', ['31.2350,121.4660'])
      : mapRouteUrl('哈尔滨市', ['天津市', '沈阳市'])) : mapUrlAtLocation());
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'geolocation' && webContents === mapView?.webContents);
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());

ipcMain.handle('get-settings', () => ({ ...settings }));

ipcMain.on('open-panel-from-map', (event, name) => {
  if (event.sender !== mapView?.webContents || !['settings', 'route', 'avatar'].includes(name)) return;
  mainWindow.webContents.send('open-panel', name);
});

ipcMain.handle('set-display-mode', async (_event, mode) => {
  if (mode !== 'phone' && mode !== 'duo') throw new Error('无效的显示模式');
  settings = { ...settings, displayMode: mode };
  saveSettings(settings);
  applyDisplayMode();
  await applyMapAppearance();
  return { ...settings };
});

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
    ? waypoints.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 24)
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
