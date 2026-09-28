# MeiMap

一个只供个人使用的 Windows Google Maps 外壳。它直接打开 Google Maps 网页，不使用 Google Maps Platform API，因此不需要 API Key 或计费账户。

## 功能

- iPhone 风格的窄屏桌面窗口
- Google Maps 自带的地点搜索
- 自定义“当前位置”（保存在本机 JSON 文件中）
- 以自定义位置为起点规划驾车或步行路线
- 无账户、无后端、无数据库

## 运行

```powershell
pnpm install
pnpm start
```

首次启动默认位置为香港。点击底部“设置”可以填写纬度、经度；点击“当前位置”会让地图回到该坐标。Google Maps 网页中的定位按钮也会读取这个模拟位置。

## 打包

```powershell
pnpm dist
```

生成的便携版程序位于 `dist` 目录。

## 说明

MeiMap 依赖 Google Maps 网页，必须联网。网页结构和行为由 Google 控制，将来可能变化。应用不会读取 Windows 的真实定位，也不会修改系统定位。
