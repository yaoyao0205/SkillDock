'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog, Menu, nativeTheme } = require('electron');
const fs = require('fs');
const path = require('path');

const settings = require('./settings');
const skills = require('./skills');
const mcp = require('./mcp');

app.setName('SkillDock');

let mainWindow = null;
let lastScan = null;

function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      const data = await fn(...args);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: (err && err.message) || String(err) };
    }
  });
}

function scanAll() {
  const cfg = settings.get();
  lastScan = skills.scan(cfg.roots);
  const clients = mcp.list(cfg.configs);
  return {
    settings: cfg,
    skills: lastScan.skills,
    roots: lastScan.roots,
    clients,
    scannedAt: lastScan.scannedAt,
    home: settings.homeDir(),
    platform: process.platform,
    appVersion: app.getVersion(),
    dataDir: app.getPath('userData'),
    backupDir: settings.backupDir()
  };
}

function registerIpc() {
  handle('state:load', () => scanAll());
  handle('state:rescan', () => scanAll());

  handle('skill:read', (id) => skills.details(id));
  handle('skill:save', ({ id, content }) => skills.save(id, content));
  handle('skill:create', (payload) => {
    const result = skills.create(payload);
    return { ...result, state: scanAll() };
  });

  handle('root:add', async (payload) => {
    settings.addRoot(payload);
    return scanAll();
  });
  handle('root:remove', async (id) => {
    settings.removeRoot(id);
    return scanAll();
  });

  handle('mcp:save', (payload) => ({ ...mcp.saveServer(payload), state: scanAll() }));
  handle('mcp:delete', (payload) => ({ ...mcp.deleteServer(payload), state: scanAll() }));
  handle('mcp:list', () => mcp.list(settings.get().configs));

  handle('config:add', async (payload) => {
    settings.addConfig(payload);
    return scanAll();
  });
  handle('config:remove', async (id) => {
    settings.removeConfig(id);
    return scanAll();
  });

  handle('ui:lastView', (view) => {
    settings.setLastView(view);
    return true;
  });

  handle('shell:showItem', (file) => {
    shell.showItemInFolder(file);
    return true;
  });
  handle('shell:openPath', async (target) => {
    const err = await shell.openPath(target);
    if (err) throw new Error(err);
    return true;
  });
  handle('shell:openExternal', (url) => {
    if (!/^https?:/i.test(url)) throw new Error('只允许打开 http/https 链接');
    return shell.openExternal(url);
  });

  handle('dialog:pickDir', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: '选择 Skill 目录'
    });
    return res.canceled ? null : res.filePaths[0];
  });
  handle('dialog:pickFile', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      title: '选择 MCP 配置文件'
    });
    return res.canceled ? null : res.filePaths[0];
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: 'SkillDock',
            submenu: [
              { role: 'about', label: '关于 SkillDock' },
              { type: 'separator' },
              { role: 'hide', label: '隐藏' },
              { role: 'hideOthers', label: '隐藏其他' },
              { role: 'unhide', label: '显示全部' },
              { type: 'separator' },
              { role: 'quit', label: '退出' }
            ]
          }
        ]
      : []),
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '窗口',
      submenu: [{ role: 'minimize', label: '最小化' }, { role: 'close', label: '关闭' }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    backgroundColor: '#0b0c0e',
    title: 'SkillDock',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 20 },
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.SKILLDOCK_SHOT === '1') {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => runScreenshots(mainWindow), 900);
    });
  }

  if (process.env.SKILLDOCK_E2E === '1') {
    mainWindow.__userData = app.getPath('userData');
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const runE2E = require('../../scripts/e2e-ui');
          const ok = await runE2E(mainWindow);
          app.exit(ok ? 0 : 1);
        } catch (err) {
          console.error('[e2e] failed:', err);
          app.exit(1);
        }
      }, 800);
    });
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runScreenshots(win) {
  const outDir = process.env.SKILLDOCK_SHOT_DIR || path.join(process.cwd(), 'shots');
  fs.mkdirSync(outDir, { recursive: true });
  const shot = async (name) => {
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, `${name}.png`), image.toPNG());
  };
  const js = (code) => win.webContents.executeJavaScript(code, true);

  try {
    await shot('01-overview');
    await js(`document.querySelector('[data-nav="skills"]').click(); 'ok'`);
    await delay(500);
    await shot('02-skills');
    await js(`document.querySelector('.skill-card').click(); 'ok'`);
    await delay(700);
    await shot('03-skill-detail');
    await js(`document.querySelector('[data-close-drawer]').click(); document.querySelector('[data-nav="mcp"]').click(); 'ok'`);
    await delay(500);
    await shot('04-mcp');
    const edit = await js(
      `(() => { const b = document.querySelector('[data-mcp-edit]'); if(!b) return 'missing'; b.click(); return 'clicked'; })()`
    );
    console.log('[shot] mcp edit:', edit);
    await delay(700);
    await shot('05-mcp-edit');
    await js(`document.querySelector('.modal-overlay') && document.querySelector('.modal-overlay').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); 'ok'`);
    await delay(300);
    await js(`document.querySelector('[data-nav="settings"]').click(); 'ok'`);
    await delay(400);
    await shot('06-settings');
    await js(`document.querySelector('[data-nav="overview"]').click(); document.querySelector('[data-primary]').click(); 'ok'`);
    await delay(500);
    await shot('07-new-skill');
    await js(`document.querySelector('.modal-close').click(); 'ok'`);
    await delay(300);
    await js(`document.querySelector('[data-nav="mcp"]').click(); document.querySelector('[data-new-mcp]').click(); 'ok'`);
    await delay(500);
    await shot('08-new-mcp');
    console.log('[shot] done');
  } catch (err) {
    console.error('[shot] failed:', err);
  } finally {
    setTimeout(() => app.quit(), 400);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    nativeTheme.themeSource = 'dark';
    if (process.platform === 'darwin' && app.dock) {
      try {
        app.dock.setIcon(path.join(__dirname, '..', '..', 'build', 'icon.png'));
      } catch (_) {}
    }
    registerIpc();
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
