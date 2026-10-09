const screens = {
  settings: document.querySelector('#settings-screen'),
  route: document.querySelector('#route-screen'),
  avatar: document.querySelector('#avatar-screen'),
  error: document.querySelector('#error-screen'),
};

const tabs = [...document.querySelectorAll('.tabbar button')];
const locationInput = document.querySelector('#location-input');
const message = document.querySelector('#settings-message');
window.meiMap.onOpenPanel((name) => {
  const tab = { settings: '#tab-settings', route: '#tab-route', avatar: '#tab-avatar' }[name];
  if (tab) document.querySelector(tab).click();
});
let displayedTime = '';

function updateDisplayMode(mode) {
  document.body.classList.toggle('duo', mode === 'duo');
  for (const value of ['phone', 'duo']) {
    document.querySelector(`#mode-${value}`).setAttribute('aria-pressed', String(mode === value));
  }
}

function syncStatus(current) {
  displayedTime = current.timeOverride || '';
  updateClock();
  const level = current.batteryLevel ?? 76;
  document.querySelector('.battery-svg rect:nth-child(2)').setAttribute('width', String(19.5 * level / 100));
  document.querySelector('.battery-svg').style.color = level <= 20 ? '#ff3b30' : '';
  document.querySelector('.duo-battery-level').setAttribute('stroke-dasharray', `${level} 100`);
  document.querySelector('.duo-battery-level').style.color = level <= 20 ? '#ff3b30' : '';
}

window.meiMap.onDisplayModeChanged(updateDisplayMode);
window.meiMap.getSettings().then((current) => {
  updateDisplayMode(current.displayMode || 'phone');
  syncStatus(current);
});

for (const mode of ['phone', 'duo']) {
  document.querySelector(`#mode-${mode}`).addEventListener('click', async () => {
    const output = document.querySelector('#mode-message');
    try {
      const current = await window.meiMap.setDisplayMode(mode);
      updateDisplayMode(current.displayMode);
      output.textContent = '已切换，点击探索查看地图';
      output.classList.remove('error');
    } catch (error) {
      output.textContent = error.message;
      output.classList.add('error');
    }
  });
}

function showScreenshotDirectory(directory) {
  document.querySelector('#screenshot-directory').textContent = directory || '桌面（默认）';
}

function showLocalScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.add('hidden'));
  if (screens[name]) screens[name].classList.remove('hidden');
  tabs.forEach((tab) => tab.classList.toggle('active', tab.id === `tab-${name}`));
}

function showMap() {
  Object.values(screens).forEach((screen) => screen.classList.add('hidden'));
  tabs.forEach((tab) => tab.classList.toggle('active', tab.id === 'tab-map'));
  window.meiMap.showMap();
}

document.querySelector('#tab-map').addEventListener('click', showMap);
document.querySelector('#tab-route').addEventListener('click', async () => {
  const current = await window.meiMap.getSettings();
  document.querySelector('#route-current-location').textContent = current.locationLabel || `${current.latitude}, ${current.longitude}`;
  showLocalScreen('route');
  window.meiMap.showSettings();
  document.querySelector('#destination').focus();
});

document.querySelector('#tab-settings').addEventListener('click', async () => {
  const current = await window.meiMap.getSettings();
  locationInput.value = current.locationLabel || `${current.latitude}, ${current.longitude}`;
  message.textContent = '';
  showLocalScreen('settings');
  window.meiMap.showSettings();
});

document.querySelector('#tab-avatar').addEventListener('click', async () => {
  const current = await window.meiMap.getSettings();
  const preview = document.querySelector('#avatar-preview');
  preview.src = current.avatarDataUrl || '';
  preview.classList.toggle('empty', !current.avatarDataUrl);
  document.querySelector('#display-time').value = current.timeOverride || '';
  document.querySelector('#battery-level').value = current.batteryLevel ?? 76;
  document.querySelector('#battery-level-value').textContent = `${current.batteryLevel ?? 76}%`;
  document.querySelector('#avatar-message').textContent = '';
  document.querySelector('#screenshot-message').textContent = '';
  showScreenshotDirectory(current.screenshotDirectory);
  showLocalScreen('avatar');
  window.meiMap.showSettings();
});

document.querySelector('#settings-back').addEventListener('click', showMap);
document.querySelector('#route-back').addEventListener('click', showMap);
document.querySelector('#avatar-back').addEventListener('click', showMap);
document.querySelector('#minimize').addEventListener('click', () => window.meiMap.minimize());
document.querySelector('#close').addEventListener('click', () => window.meiMap.close());

document.querySelector('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  message.classList.remove('error');
  message.textContent = '正在保存…';
  try {
    const saved = await window.meiMap.saveLocationInput(locationInput.value);
    locationInput.value = saved.locationLabel || `${saved.latitude}, ${saved.longitude}`;
    message.textContent = '已保存，新的位置现在生效';
  } catch (error) {
    message.classList.add('error');
    message.textContent = error.message;
  }
});

document.querySelectorAll('.presets button').forEach((button) => {
  button.addEventListener('click', () => {
    locationInput.value = button.dataset.location;
  });
});

const waypointList = document.querySelector('#waypoint-list');
const addWaypointButton = document.querySelector('#add-waypoint');
const routeMessage = document.querySelector('#route-message');
const MAX_WAYPOINTS = 24;

function refreshWaypointRows() {
  const rows = [...waypointList.querySelectorAll('.waypoint-row')];
  rows.forEach((row, index) => {
    row.querySelector('.waypoint-label').textContent = `途经点 ${index + 1}`;
    row.querySelector('input').placeholder = `例如：中环、尖沙咀或坐标`;
    row.querySelector('.move-waypoint-up').disabled = index === 0;
    row.querySelector('.move-waypoint-down').disabled = index === rows.length - 1;
  });
  addWaypointButton.disabled = rows.length >= MAX_WAYPOINTS;
}

function addWaypoint(value = '') {
  if (waypointList.children.length >= MAX_WAYPOINTS) return;
  const row = document.createElement('label');
  row.className = 'stacked waypoint-row';
  row.innerHTML = `<span class="waypoint-label"></span><span class="waypoint-control"><input class="waypoint-input" autocomplete="off" value="${value.replace(/"/g, '&quot;')}" /><span class="waypoint-actions"><button class="move-waypoint-up" type="button" aria-label="上移途经点">↑</button><button class="move-waypoint-down" type="button" aria-label="下移途经点">↓</button><button class="remove-waypoint" type="button" aria-label="删除途经点">×</button></span></span>`;
  row.querySelector('.move-waypoint-up').addEventListener('click', () => {
    const previous = row.previousElementSibling;
    if (previous) waypointList.insertBefore(row, previous);
    refreshWaypointRows();
  });
  row.querySelector('.move-waypoint-down').addEventListener('click', () => {
    const next = row.nextElementSibling;
    if (next) waypointList.insertBefore(next, row);
    refreshWaypointRows();
  });
  row.querySelector('.remove-waypoint').addEventListener('click', () => {
    row.remove();
    refreshWaypointRows();
  });
  waypointList.appendChild(row);
  refreshWaypointRows();
}

addWaypointButton.addEventListener('click', () => addWaypoint());

document.querySelector('#route-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const destination = document.querySelector('#destination').value.trim();
  const waypoints = [...document.querySelectorAll('.waypoint-input')]
    .map((input) => input.value.trim())
    .filter(Boolean);
  if (waypoints.length > MAX_WAYPOINTS) {
    routeMessage.classList.add('error');
    routeMessage.textContent = `最多支持 ${MAX_WAYPOINTS} 个途经点`;
    return;
  }
  routeMessage.classList.remove('error');
  routeMessage.textContent = '正在加载驾车路线…';
  window.meiMap.openRoute(destination, waypoints);
});

async function saveAvatar(avatarDataUrl) {
  const avatarMessage = document.querySelector('#avatar-message');
  avatarMessage.classList.remove('error');
  avatarMessage.textContent = '正在保存…';
  try {
    await window.meiMap.saveSettings({ avatarDataUrl });
    const preview = document.querySelector('#avatar-preview');
    preview.src = avatarDataUrl;
    preview.classList.toggle('empty', !avatarDataUrl);
    avatarMessage.textContent = avatarDataUrl ? '头像已更新' : '已恢复默认头像';
  } catch (error) {
    avatarMessage.classList.add('error');
    avatarMessage.textContent = error.message;
  }
}

document.querySelector('#avatar-file').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      const side = Math.min(image.width, image.height);
      context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 256, 256);
      saveAvatar(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});

document.querySelector('#avatar-clear').addEventListener('click', () => saveAvatar(''));

document.querySelector('#choose-screenshot-directory').addEventListener('click', async () => {
  const screenshotMessage = document.querySelector('#screenshot-message');
  const directory = await window.meiMap.chooseScreenshotDirectory();
  if (directory == null) return;
  showScreenshotDirectory(directory);
  screenshotMessage.textContent = '截图将保存到这个文件夹';
});

document.querySelector('#reset-screenshot-directory').addEventListener('click', async () => {
  await window.meiMap.resetScreenshotDirectory();
  showScreenshotDirectory('');
  document.querySelector('#screenshot-message').textContent = '已恢复保存到桌面';
});

document.querySelector('#display-time-reset').addEventListener('click', () => {
  document.querySelector('#display-time').value = '';
  document.querySelector('#display-settings-message').textContent = '将使用系统时间';
});

document.querySelector('#battery-level').addEventListener('input', (event) => {
  document.querySelector('#battery-level-value').textContent = `${event.target.value}%`;
});

document.querySelector('#battery-level-reset').addEventListener('click', () => {
  document.querySelector('#battery-level').value = '76';
  document.querySelector('#battery-level-value').textContent = '76%';
  document.querySelector('#display-settings-message').textContent = '已恢复默认电量';
});

document.querySelector('#display-settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const displayMessage = document.querySelector('#display-settings-message');
  displayMessage.classList.remove('error');
  displayMessage.textContent = '正在保存…';
  try {
    const saved = await window.meiMap.saveSettings({
      timeOverride: document.querySelector('#display-time').value,
      batteryLevel: document.querySelector('#battery-level').value,
    });
    syncStatus(saved);
    displayMessage.textContent = '显示设置已应用';
  } catch (error) {
    displayMessage.classList.add('error');
    displayMessage.textContent = error.message;
  }
});

document.querySelector('#retry').addEventListener('click', () => window.meiMap.goCurrentLocation());

window.meiMap.onScreenChanged((screen) => {
  if (screen === 'map') {
    Object.values(screens).forEach((item) => item.classList.add('hidden'));
  }
});

window.meiMap.onMapError((error) => {
  document.querySelector('#error-message').textContent = `${error.description}（${error.code}）`;
  showLocalScreen('error');
  window.meiMap.showSettings();
});

function updateClock() {
  document.querySelector('#clock').textContent = displayedTime || new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
}

updateClock();
setInterval(updateClock, 30_000);
