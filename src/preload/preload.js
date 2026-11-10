'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skilldock', {
  platform: process.platform,
  loadState: () => ipcRenderer.invoke('state:load'),
  rescan: () => ipcRenderer.invoke('state:rescan'),
  readSkill: (id) => ipcRenderer.invoke('skill:read', id),
  saveSkill: (payload) => ipcRenderer.invoke('skill:save', payload),
  createSkill: (payload) => ipcRenderer.invoke('skill:create', payload),
  addRoot: (payload) => ipcRenderer.invoke('root:add', payload),
  removeRoot: (id) => ipcRenderer.invoke('root:remove', id),
  saveMcp: (payload) => ipcRenderer.invoke('mcp:save', payload),
  deleteMcp: (payload) => ipcRenderer.invoke('mcp:delete', payload),
  addConfig: (payload) => ipcRenderer.invoke('config:add', payload),
  removeConfig: (id) => ipcRenderer.invoke('config:remove', id),
  rememberView: (view) => ipcRenderer.invoke('ui:lastView', view),
  showItem: (file) => ipcRenderer.invoke('shell:showItem', file),
  openPath: (target) => ipcRenderer.invoke('shell:openPath', target),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  pickDir: () => ipcRenderer.invoke('dialog:pickDir'),
  pickFile: () => ipcRenderer.invoke('dialog:pickFile')
});
