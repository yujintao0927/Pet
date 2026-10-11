'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('boardpet', {
  // 初始功德数（启动时读一次，之后本地累加显示）
  getCount: () => ipcRenderer.invoke('muyu:getCount'),
  // 上报一击：fire-and-forget，主进程内存累加 + 节流落盘
  hit: () => ipcRenderer.send('muyu:hit'),
});
