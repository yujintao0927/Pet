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
npx electron-builder --win portable   # 产物在 release/
```

## 文档

- docs/需求对齐单.md — 需求对齐结论
- docs/01-调研报告.md … 07-复盘报告.md — 开发流程各阶段文档

## 分支策略

单人项目，主干开发（main 直接提交，conventional commits）。
