const screens = {
  settings: document.querySelector('#settings-screen'),
  route: document.querySelector('#route-screen'),
  avatar: document.querySelector('#avatar-screen'),
  error: document.querySelector('#error-screen'),
};

const tabs = [...document.querySelectorAll('.tabbar button')];
const latitude = document.querySelector('#latitude');
const longitude = document.querySelector('#longitude');
const message = document.querySelector('#settings-message');

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
document.querySelector('#tab-route').addEventListener('click', () => {
  showLocalScreen('route');
  window.meiMap.showSettings();
  document.querySelector('#destination').focus();
});

document.querySelector('#tab-settings').addEventListener('click', async () => {
  const current = await window.meiMap.getSettings();
  latitude.value = current.latitude;
  longitude.value = current.longitude;
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
  setHeadingValue(current.heading ?? 0);
  document.querySelector('#avatar-message').textContent = '';
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
    await window.meiMap.saveSettings({ latitude: latitude.value, longitude: longitude.value });
    message.textContent = '已保存，新的位置现在生效';
  } catch (error) {
    message.classList.add('error');
    message.textContent = error.message;
  }
});

document.querySelectorAll('.presets button').forEach((button) => {
  button.addEventListener('click', () => {
    latitude.value = button.dataset.lat;
    longitude.value = button.dataset.lng;
  });
});

document.querySelector('#route-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const destination = document.querySelector('#destination').value;
  const mode = document.querySelector('input[name="mode"]:checked').value;
  window.meiMap.openRoute(destination, mode);
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

function headingLabel(value) {
  const heading = Number(value) || 0;
  const names = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  return `${heading}° ${names[Math.round(heading / 45) % 8]}`;
}

function setHeadingValue(value) {
  const heading = document.querySelector('#heading');
  heading.value = Number(value) || 0;
  document.querySelector('#heading-value').textContent = headingLabel(heading.value);
}

document.querySelector('#heading').addEventListener('input', (event) => {
  document.querySelector('#heading-value').textContent = headingLabel(event.target.value);
});

document.querySelector('#display-time-reset').addEventListener('click', () => {
  document.querySelector('#display-time').value = '';
  document.querySelector('#display-settings-message').textContent = '将使用系统时间';
});

document.querySelector('#display-settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const displayMessage = document.querySelector('#display-settings-message');
  displayMessage.classList.remove('error');
  displayMessage.textContent = '正在保存…';
  try {
    await window.meiMap.saveSettings({
      timeOverride: document.querySelector('#display-time').value,
      heading: document.querySelector('#heading').value,
    });
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
  document.querySelector('#clock').textContent = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
}

updateClock();
setInterval(updateClock, 30_000);
