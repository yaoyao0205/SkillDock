'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { app } = require('electron');

function homeDir() {
  return process.env.SKILLDOCK_HOME || os.homedir();
}

function uid(prefix, value) {
  return `${prefix}-${crypto.createHash('md5').update(value).digest('hex').slice(0, 10)}`;
}

function expand(value) {
  if (!value) return '';
  let p = String(value).trim();
  if (p === '~') p = homeDir();
  if (p.startsWith('~/')) p = path.join(homeDir(), p.slice(2));
  if (p.startsWith('~')) p = path.join(homeDir(), p.slice(1));
  return p;
}

function normalizePath(value) {
  const p = expand(value);
  if (!p) throw new Error('路径不能为空');
  if (!path.isAbsolute(p)) throw new Error('请填写绝对路径，或使用 ~ 开头的用户目录路径');
  return path.normalize(p);
}

function defaultRoots() {
  return [
    { label: 'Claude Code', path: expand('~/.claude/skills') },
    { label: 'Agent Skills', path: expand('~/.agents/skills') },
    { label: 'Codex', path: expand('~/.codex/skills') },
    { label: 'Cursor', path: expand('~/.cursor/skills') },
    { label: 'Doubao 内置', path: expand('~/.doubao/agent_mode/workspace/.skills') },
    { label: 'Doubao 用户技能', path: expand('~/.doubao/agent_mode/workspace/.user_skills') }
  ];
}

function defaultConfigs() {
  return [
    { label: 'Claude Code', path: expand('~/.claude.json'), format: 'json', key: 'mcpServers' },
    {
      label: 'Claude Desktop',
      path: expand('~/Library/Application Support/Claude/claude_desktop_config.json'),
      format: 'json',
      key: 'mcpServers'
    },
    { label: 'Cursor', path: expand('~/.cursor/mcp.json'), format: 'json', key: 'mcpServers' },
    { label: 'Codex', path: expand('~/.codex/config.toml'), format: 'toml', key: 'mcp_servers' },
    { label: 'VS Code', path: expand('~/.vscode/mcp.json'), format: 'json', key: 'servers' }
  ];
}

function makeSettings() {
  const roots = defaultRoots().map((r) => ({
    id: uid('root', r.path),
    label: r.label,
    path: r.path,
    enabled: true
  }));
  const configs = defaultConfigs().map((c) => ({
    id: uid('mcp', c.path),
    label: c.label,
    path: c.path,
    format: c.format,
    key: c.key,
    enabled: true
  }));
  return { version: 1, roots, configs, ui: { lastView: 'overview' } };
}

function settingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}

let cache = null;

function load() {
  if (cache) return cache;
  const file = settingsFile();
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed && Array.isArray(parsed.roots) && Array.isArray(parsed.configs)) {
        cache = parsed;
        return cache;
      }
    }
  } catch (err) {
    // 配置损坏时回退到默认配置，并在原文件旁保留一份副本
    try {
      fs.copyFileSync(file, `${file}.broken-${Date.now()}`);
    } catch (_) {}
  }
  cache = makeSettings();
  save();
  return cache;
}

function save() {
  const file = settingsFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

function get() {
  return load();
}

function addRoot({ label, path: rawPath }) {
  const s = load();
  const p = normalizePath(rawPath);
  if (s.roots.some((r) => r.path === p)) throw new Error('该目录已在列表中');
  const root = {
    id: uid('root', p + s.roots.length),
    label: label && label.trim() ? label.trim() : path.basename(path.dirname(p)) + '/' + path.basename(p),
    path: p,
    enabled: true
  };
  s.roots.push(root);
  save();
  return root;
}

function removeRoot(id) {
  const s = load();
  s.roots = s.roots.filter((r) => r.id !== id);
  save();
  return s;
}

function addConfig({ label, path: rawPath, format, key }) {
  const s = load();
  const p = normalizePath(rawPath);
  if (s.configs.some((c) => c.path === p)) throw new Error('该配置文件已在列表中');
  const fmt = format === 'toml' ? 'toml' : 'json';
  const config = {
    id: uid('mcp', p + s.configs.length),
    label: label && label.trim() ? label.trim() : '自定义配置',
    path: p,
    format: fmt,
    key: key && key.trim() ? key.trim() : fmt === 'toml' ? 'mcp_servers' : 'mcpServers',
    enabled: true
  };
  s.configs.push(config);
  save();
  return config;
}

function removeConfig(id) {
  const s = load();
  s.configs = s.configs.filter((c) => c.id !== id);
  save();
  return s;
}

function setLastView(view) {
  const s = load();
  s.ui = Object.assign({}, s.ui, { lastView: view });
  save();
}

module.exports = {
  homeDir,
  expand,
  normalizePath,
  get,
  save,
  addRoot,
  removeRoot,
  addConfig,
  removeConfig,
  setLastView,
  settingsFile,
  backupDir: () => path.join(app.getPath('userData'), 'backups')
};
