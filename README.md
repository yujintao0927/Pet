# BoardPet 🏀

篮球主题 Windows 桌面宠物：Q 版球星常驻桌面（默认勒布朗·詹姆斯 / 76 人配色），点击查看 NBA 实时赛程与球员数据，关注的比赛开赛提醒、关键时刻自动庆祝。

## 环境要求

- Windows 10/11 x64
- Node.js ≥ 20（开发运行）

## 启动

```bash
npm install
npm start        # 启动应用
npm test         # 运行单元测试（数据解析等）
npm run smoke    # 冒烟测试：启动 2.5 秒后自动退出
```

## 打包绿色版

```bash
# 首次安装依赖若下载 Electron 失败，先设置镜像：
#   set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
node scripts/gen-icon.js          # 生成 assets/icon.ico / tray.png

# 注意：Git Bash 会把以 / 开头的参数改写成 Windows 路径（如 ^/(release) → ^D:/Git/(release)），
# 导致 --ignore 正则失效、把 docs/tests/node_modules 甚至备份目录打进 app.asar。
# 因此必须加 MSYS_NO_PATHCONV=1。
MSYS_NO_PATHCONV=1 ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
  npx electron-packager . BoardPet --platform=win32 --arch=x64 \
  --icon=assets/icon.ico --out=release --overwrite --prune=true \
  --ignore="^/(release|release_backup|docs|tests|scripts|smoke|\.git|CHANGELOG\.md|README\.md)"
# 产物：release/BoardPet-win32-x64/BoardPet.exe（免安装，整个文件夹拷贝即用）
# 校验：app.asar 应只有约 160KB（含 src/、assets/、package.json）；若达数百 MB 说明 --ignore 没生效
```

## 冒烟测试（自动截图验收）

```bash
npm run smoke   # 启动后依次截取 宠物/赛程/详情/设置 各窗口到系统临时目录并打印日志
```

## 文档

- CHANGELOG.md — 用户可感知的变化
- docs/需求对齐单.md — 需求对齐结论（v0.1）
- docs/需求对齐单-迭代2.md — 迭代2 对齐结论（提速/走动/缩放）
- docs/01-调研报告.md … 07-复盘报告.md — 开发流程各阶段文档
- docs/changes/ — 增量需求变更文档（`20261010-ux-optimize` 体验优化、`20261012-muyu` 敲球功德木鱼）
- design/muyu-preview/ — 木鱼设计资产（音色 WAV、概念 SVG、可交互试听页 `preview.html`，双击即可玩）

## 分支策略

单人项目，主干开发（main 直接提交，conventional commits）。
