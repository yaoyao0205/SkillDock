'use strict';

const fs = require('fs');
const path = require('path');
const backups = require('./backups');
const settings = require('./settings');

function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function detectIndent(text) {
  const m = text.match(/\n([ \t]+)"/);
  return m ? m[1] : '  ';
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeServer(name, raw, meta) {
  const src = isPlainObject(raw) ? raw : {};
  let transport = src.type || src.transport || '';
  if (!transport) transport = src.url ? 'http' : 'stdio';
  transport = String(transport).toLowerCase();
  if (transport === 'streamable-http' || transport === 'streamablehttp') transport = 'http';
  return {
    name,
    transport,
    command: typeof src.command === 'string' ? src.command : '',
    args: Array.isArray(src.args) ? src.args : typeof src.args === 'string' ? [src.args] : [],
    env: isPlainObject(src.env) ? src.env : {},
    url: typeof src.url === 'string' ? src.url : '',
    headers: isPlainObject(src.headers) ? src.headers : {},
    disabled: src.disabled === true || src.enabled === false,
    level: meta.level,
    projectPath: meta.projectPath || '',
    configId: meta.configId,
    readOnly: !!meta.readOnly,
    clientLabel: meta.clientLabel
  };
}

function serverContainer(obj, entry) {
  if (!isPlainObject(obj)) return null;
  const keys = [entry.key, 'mcpServers', 'servers'].filter(Boolean);
  for (const key of keys) {
    if (isPlainObject(obj[key])) return { key, container: obj[key] };
  }
  return { key: entry.key || 'mcpServers', container: null };
}

function listJson(entry) {
  const text = readText(entry.path);
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (err) {
    return { servers: [], parseError: `JSON 格式错误：${err.message}` };
  }
  if (!isPlainObject(obj)) return { servers: [], parseError: '配置文件根节点不是对象' };

  const servers = [];
  const found = serverContainer(obj, entry);
  if (found.container) {
    for (const [name, raw] of Object.entries(found.container)) {
      servers.push(
        normalizeServer(name, raw, {
          level: 'global',
          configId: entry.id,
          clientLabel: entry.label,
          readOnly: false
        })
      );
    }
  }

  if (entry.key === 'mcpServers' && isPlainObject(obj.projects)) {
    for (const [projectPath, project] of Object.entries(obj.projects)) {
      if (!isPlainObject(project) || !isPlainObject(project.mcpServers)) continue;
      for (const [name, raw] of Object.entries(project.mcpServers)) {
        servers.push(
          normalizeServer(name, raw, {
            level: 'project',
            projectPath,
            configId: entry.id,
            clientLabel: entry.label,
            readOnly: false
          })
        );
      }
    }
  }
  return { servers, parseError: '' };
}

function parseTomlValue(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  if (v.startsWith('[') && v.endsWith(']')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((s) => parseTomlValue(s))
      .filter((s) => s !== '');
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

function stripTomlComment(line) {
  let inQuote = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && line[i - 1] !== '\\') inQuote = !inQuote;
    if (ch === '#' && !inQuote) return line.slice(0, i);
  }
  return line;
}

// 只读解析 Codex 的 [mcp_servers.x] 结构，TOML 写回容易破坏格式，这里不做写入
function listToml(entry) {
  const text = readText(entry.path);
  const servers = [];
  let current = null;
  let envMode = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim();
    if (!line) continue;
    const section = line.match(/^\[([^\]]+)\]$/);
    if (section) {
      const parts = section[1].split('.');
      if (parts[0] !== (entry.key || 'mcp_servers') || parts.length < 2) {
        current = null;
        envMode = false;
        continue;
      }
      const name = parts[1].replace(/["']/g, '');
      current = servers.find((s) => s.name === name);
      if (!current) {
        current = {
          name,
          transport: 'stdio',
          command: '',
          args: [],
          env: {},
          url: '',
          headers: {},
          disabled: false,
          level: 'global',
          projectPath: '',
          configId: entry.id,
          readOnly: true,
          clientLabel: entry.label
        };
        servers.push(current);
      }
      envMode = parts[2] === 'env';
      continue;
    }
    if (!current) continue;
    const pair = line.match(/^([A-Za-z0-9_\-]+)\s*=\s*(.+)$/);
    if (!pair) continue;
    const value = parseTomlValue(pair[2]);
    if (envMode) {
      current.env[pair[1]] = String(value);
      continue;
    }
    if (pair[1] === 'command') current.command = String(value);
    if (pair[1] === 'args') current.args = Array.isArray(value) ? value : [value];
    if (pair[1] === 'url') {
      current.url = String(value);
      current.transport = 'http';
    }
    if (pair[1] === 'enabled' || pair[1] === 'disabled') {
      current.disabled = pair[1] === 'disabled' ? value === true : value === false;
    }
  }

  if (!servers.length) {
    return { servers, parseError: '', note: '未找到 mcp_servers 配置段' };
  }
  return { servers, parseError: '' };
}

function list(configs) {
  return configs
    .filter((c) => c.enabled !== false)
    .map((entry) => {
      const exists = fs.existsSync(entry.path);
      const base = {
        id: entry.id,
        label: entry.label,
        path: entry.path,
        format: entry.format || 'json',
        key: entry.key,
        exists,
        readOnly: (entry.format || 'json') === 'toml',
        servers: [],
        parseError: '',
        note: '',
        mtime: 0
      };
      if (!exists) return base;
      try {
        base.mtime = fs.statSync(entry.path).mtimeMs;
        const result = entry.format === 'toml' ? listToml(entry) : listJson(entry);
        base.servers = result.servers;
        base.parseError = result.parseError || '';
        base.note = result.note || '';
      } catch (err) {
        base.parseError = err.message;
      }
      return base;
    });
}

function resolveEntry(configId) {
  const entry = settings.get().configs.find((c) => c.id === configId);
  if (!entry) throw new Error('配置文件不存在，请刷新设置');
  return entry;
}

function ensureJsonObject(file) {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{}\n', 'utf8');
  }
  const text = readText(file);
  let obj;
  try {
    obj = JSON.parse(text || '{}');
  } catch (err) {
    throw new Error(`配置文件不是合法 JSON，已停止写入：${err.message}`);
  }
  if (!isPlainObject(obj)) throw new Error('配置文件根节点不是对象，已停止写入');
  return { text, obj };
}

function containerFor(obj, entry, level, projectPath) {
  if (level === 'project') {
    if (!isPlainObject(obj.projects)) obj.projects = {};
    if (!isPlainObject(obj.projects[projectPath])) obj.projects[projectPath] = {};
    if (!isPlainObject(obj.projects[projectPath].mcpServers)) {
      obj.projects[projectPath].mcpServers = {};
    }
    return obj.projects[projectPath].mcpServers;
  }
  const key = entry.key || 'mcpServers';
  if (!isPlainObject(obj[key])) {
    if (isPlainObject(obj.mcpServers)) return obj.mcpServers;
    if (isPlainObject(obj.servers)) return obj.servers;
    obj[key] = {};
  }
  return obj[key];
}

function buildServer(payload, existing) {
  const base = isPlainObject(existing) ? { ...existing } : {};
  const transport = payload.transport === 'sse' ? 'sse' : payload.transport === 'http' ? 'http' : 'stdio';

  if (transport === 'stdio') {
    delete base.url;
    delete base.headers;
    delete base.type;
    delete base.transport;
    base.command = String(payload.command || '').trim();
    base.args = Array.isArray(payload.args)
      ? payload.args.map((a) => String(a)).filter((a) => a !== '')
      : String(payload.args || '')
          .split(/\r?\n/)
          .map((a) => a.trim())
          .filter(Boolean);
    const env = payload.env && typeof payload.env === 'object' ? payload.env : {};
    const cleanEnv = {};
    for (const [k, v] of Object.entries(env)) {
      if (String(k).trim()) cleanEnv[String(k).trim()] = String(v);
    }
    if (Object.keys(cleanEnv).length) base.env = cleanEnv;
    else delete base.env;
  } else {
    delete base.command;
    delete base.args;
    delete base.env;
    base.type = transport;
    base.url = String(payload.url || '').trim();
    const headers = payload.headers && typeof payload.headers === 'object' ? payload.headers : {};
    const cleanHeaders = {};
    for (const [k, v] of Object.entries(headers)) {
      if (String(k).trim()) cleanHeaders[String(k).trim()] = String(v);
    }
    if (Object.keys(cleanHeaders).length) base.headers = cleanHeaders;
    else delete base.headers;
  }
  return base;
}

function saveServer(payload) {
  const entry = resolveEntry(payload.configId);
  if ((entry.format || 'json') === 'toml') throw new Error('TOML 配置暂不支持在应用内写入，请直接编辑文件');
  const file = entry.path;
  const { text, obj } = ensureJsonObject(file);
  const level = payload.level === 'project' ? 'project' : 'global';
  if (level === 'project' && !payload.projectPath) throw new Error('缺少项目路径');
  const container = containerFor(obj, entry, level, payload.projectPath);
  const originalName = payload.originalName || payload.name;
  if (payload.isEdit) {
    if (originalName !== payload.name && container[payload.name]) {
      throw new Error('已存在同名服务，请换一个名称');
    }
  } else if (container[payload.name]) {
    throw new Error('已存在同名服务，请换一个名称');
  }
  const existing = container[originalName] || container[payload.name];
  if (originalName && originalName !== payload.name) delete container[originalName];
  const server = buildServer(payload, existing);
  if (server.command !== undefined && !server.command) throw new Error('stdio 方式必须填写启动命令');
  if (server.url !== undefined && !server.url) throw new Error('远程方式必须填写服务 URL');
  container[payload.name] = server;

  backups.backupFile(file, 'mcp');
  const indent = detectIndent(text);
  backups.atomicWrite(file, JSON.stringify(obj, null, indent) + (text.endsWith('\n') || !text ? '\n' : ''));
  return { path: file };
}

function deleteServer(payload) {
  const entry = resolveEntry(payload.configId);
  if ((entry.format || 'json') === 'toml') throw new Error('TOML 配置暂不支持在应用内写入，请直接编辑文件');
  const file = entry.path;
  const { text, obj } = ensureJsonObject(file);
  const level = payload.level === 'project' ? 'project' : 'global';
  let container = null;
  if (level === 'project') {
    container = obj.projects && obj.projects[payload.projectPath] && obj.projects[payload.projectPath].mcpServers;
  } else {
    container = serverContainer(obj, entry).container;
  }
  if (!container || !(payload.name in container)) throw new Error('该服务已不存在，请重新扫描');
  delete container[payload.name];
  backups.backupFile(file, 'mcp');
  const indent = detectIndent(text);
  backups.atomicWrite(file, JSON.stringify(obj, null, indent) + (text.endsWith('\n') || !text ? '\n' : ''));
  return { path: file };
}

module.exports = { list, saveServer, deleteServer, normalizeServer };
