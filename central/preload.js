'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const names = ['overview', 'devices', 'device', 'link', 'unlink', 'deleteDevice', 'setStudyStart', 'days', 'sessions', 'hourly',
  'questionnaires', 'validation', 'setReference', 'settings', 'saveSettings', 'status', 'testRelay', 'syncNow',
  'logs', 'exportCsv', 'printPdf', 'chooseLogo', 'removeLogo', 'logo', 'openDataDir', 'dates'];

const api = {};
for (const n of names) api[n] = (arg) => ipcRenderer.invoke(`api:${n}`, arg);
api.onUpdate = (cb) => ipcRenderer.on('data-updated', () => cb());

contextBridge.exposeInMainWorld('api', api);
