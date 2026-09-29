# MeiMap

**中文** · [English](#english)

MeiMap 是一款供个人使用的 Windows 地图展示应用。它在紧凑的 iPhone 风格界面中显示 Google Maps，并允许你自行设定“当前位置”，无需使用电脑的 GPS。

应用直接加载 Google Maps 网页，不使用 Google Maps Platform API，因此不需要 Google API Key 或结算账户。

## 下载

从 [GitHub Releases](https://github.com/meistingray/MeiMap/releases/latest) 下载最新的 Windows Portable EXE。程序无需安装，直接运行即可。

## 功能

- iPhone 风格的紧凑 Windows 界面
- 自定义模拟位置
  - 直接输入地点或地址
  - 支持“纬度, 经度”，例如 `39.212387, 133.970045`
  - 地点搜索结果保存在本机缓存中
- 驾车路线展示
  - 当前位置固定为起点
  - 最多 9 个途经点
  - 途经点支持添加、删除和调整顺序
  - 目的地固定显示在路线设置底部
- 自定义顶部显示：时间、电量和头像
- 完整窗口截图
  - 快捷键：`Ctrl + Shift + S`
  - 可在“酒店”页面修改截图保存目录
- Windows Portable 单文件构建

## 使用方法

- **探索**：查看和操作地图。
- **收藏**：输入地点、地址或坐标，设置模拟当前位置。
- **路线**：以模拟位置为起点，添加途经点并显示驾车路线。
- **酒店**：设置时间、电量、头像和截图目录。

| 快捷键 | 操作 |
| --- | --- |
| `Ctrl + Shift + S` | 截取完整 MeiMap 窗口 |
| `Ctrl + M` | 最小化窗口 |
| `Ctrl + Q` | 退出 MeiMap |

## 数据与隐私

- MeiMap 不读取 Windows 的真实定位，也不会修改系统定位。
- 位置、显示设置和搜索缓存保存在本机 Electron 用户数据目录。
- 地图内容由 Google Maps 提供，使用时必须联网。
- 文字地点查询会发送到 Nominatim；坐标输入不会发送到地点搜索服务。
- 地点搜索数据：© OpenStreetMap contributors。

## 已知限制

- MeiMap 依赖 Google Maps 网页结构。Google 更新页面后，部分覆盖样式可能需要调整。
- OpenStreetMap 与 Google Maps 的地点数据可能不同。较小的商店或新地点可能需要输入更完整的地址或直接使用坐标。
- 路线功能用于地图展示，不替代实时导航。

## 本地开发

需要 Node.js 22 或兼容版本。

```powershell
npm install
npm start
```

构建 Windows Portable EXE：

```powershell
npm run dist
```

输出文件位于 `dist` 目录。

---

## English

MeiMap is a personal Windows map display app. It presents Google Maps in a compact, iPhone-inspired interface and lets you define a simulated current location without using the computer's GPS.

The app loads the Google Maps website directly. It does not use the Google Maps Platform API, so no Google API key or billing account is required.

## Download

Download the latest Windows Portable EXE from [GitHub Releases](https://github.com/meistingray/MeiMap/releases/latest). No installation is required.

## Features

- Compact, iPhone-inspired Windows interface
- Configurable simulated location
  - Enter a place name or address
  - Enter coordinates as `latitude, longitude`, for example `39.212387, 133.970045`
  - Place-search results are cached locally
- Driving route display
  - The simulated location is always the starting point
  - Up to nine waypoints
  - Add, remove, and reorder waypoints
  - The destination remains at the bottom of the route form
- Custom status display: time, battery level, and avatar
- Full-window screenshots
  - Shortcut: `Ctrl + Shift + S`
  - Configurable output directory on the Hotel page
- Single-file Windows Portable build

## Using MeiMap

- **Explore**: view and interact with the map.
- **Saved**: enter a place, address, or coordinates to set the simulated location.
- **Routes**: create a driving route from the simulated location through optional waypoints.
- **Hotel**: configure the displayed time, battery level, avatar, and screenshot directory.

| Shortcut | Action |
| --- | --- |
| `Ctrl + Shift + S` | Capture the complete MeiMap window |
| `Ctrl + M` | Minimize the window |
| `Ctrl + Q` | Quit MeiMap |

## Data and privacy

- MeiMap does not read the real Windows location or modify the system location.
- Location settings, display preferences, and the geocoding cache are stored in the local Electron user-data directory.
- Map content is provided by Google Maps and requires an internet connection.
- Text location queries are sent to Nominatim. Coordinate input does not use the place-search service.
- Place-search data: © OpenStreetMap contributors.

## Known limitations

- MeiMap depends on the Google Maps website. Future Google interface changes may require updates to MeiMap's visual overlays.
- OpenStreetMap and Google Maps may contain different place data. Small or recently added places may require a more complete address or direct coordinates.
- Route display is intended for presentation and does not replace live navigation.

## Local development

Node.js 22 or a compatible version is required.

```powershell
npm install
npm start
```

Build the Windows Portable EXE:

```powershell
npm run dist
```

The generated executable is written to `dist`.

---

© 2026 MeiStingray, Kicity Studio · [www.kicity.com](https://www.kicity.com)  
Place search © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
