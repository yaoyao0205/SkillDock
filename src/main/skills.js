'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const backups = require('./backups');

const cache = new Map(); // id -> { path, rootId, rootLabel }
let lastScanAt = null;

function shortId(value) {
  return crypto.createHash('md5').update(value).digest('hex').slice(0, 10);
}

function unquote(value) {
  let v = String(value || '').trim();
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length > 1) ||
    (v.startsWith("'") && v.endsWith("'") && v.length > 1)
  ) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

// 极简 YAML：只解析 frontmatter 里常见的 key: value / 块文本 / 行内数组
function parseFields(text) {
  const data = {};
  const lines = text.split(/\r?\n/);
  let key = null;
  let blockIndent = 0;
  let block = [];
  let blockMode = null;

  const flush = () => {
    if (!key) return;
    if (blockMode) {
      data[key] = block.join('\n').trim();
    }
    key = null;
    block = [];
    blockMode = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      if (blockMode) block.push('');
      continue;
    }
    const indent = line.match(/^\s*/)[0].length;
    if (blockMode && indent >= blockIndent) {
      block.push(line.slice(blockIndent));
      continue;
    }
    flush();
    const m = line.match(/^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    key = m[1];
    const rest = m[2];
    if (/^[|>][-+]?$/.test(rest.trim())) {
      blockMode = rest.trim();
      blockIndent = indent + 2;
      block = [];
      continue;
    }
    data[key] = unquote(rest);
    key = null;
  }
  flush();
  return data;
}

function splitFrontmatter(raw) {
  const text = raw.replace(/^\uFEFF/, '');
  if (!/^---\s*\r?\n/.test(text)) return { data: {}, body: text };
  const lines = text.split(/\r?\n/);
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (/^---\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (end < 0) return { data: {}, body: text };
  return { data: parseFields(lines.slice(1, end).join('\n')), body: lines.slice(end + 1).join('\n') };
}

function firstHeading(body) {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

function firstParagraph(body) {
  const clean = body
    .replace(/^---[\s\S]*?---/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('```'));
  if (!clean.length) return '';
  return clean.slice(0, 2).join(' ').slice(0, 400);
}

function squash(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTags(value) {
  if (!value) return [];
  const v = String(value).trim();
  if (v.startsWith('[')) {
    return v
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((s) => unquote(s))
      .filter(Boolean);
  }
  return v
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function folderStats(dir, skipName) {
  let files = 0;
  let bytes = 0;
  const extra = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === skipName || entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        extra.push(entry.name + '/');
        continue;
      }
      files += 1;
      try {
        bytes += fs.statSync(path.join(dir, entry.name)).size;
      } catch (_) {}
      extra.push(entry.name);
    }
  } catch (_) {}
  return { extraFiles: files, bytes, entries: extra.slice(0, 8) };
}

function parseSkillFile(file, meta) {
  const raw = fs.readFileSync(file, 'utf8');
  const { data, body } = splitFrontmatter(raw);
  const stat = fs.statSync(file);
  const dir = path.dirname(file);
  const fallbackName = path.basename(dir);
  const name = unquote(data.name) || firstHeading(body) || fallbackName;
  const description = squash(unquote(data.description) || firstParagraph(body));
  const stats = folderStats(dir, path.basename(file));
  const id = shortId(file);

  return {
    id,
    name,
    description,
    version: unquote(data.version) || unquote(data.license) || '',
    tags: parseTags(data.tags || data.keywords),
    path: file,
    dir,
    rootId: meta.rootId,
    rootLabel: meta.rootLabel,
    bytes: stat.size,
    mtime: stat.mtimeMs,
    entries: stats.entries,
    extraFiles: stats.extraFiles,
    valid: true,
    error: ''
  };
}

function scanRoot(root) {
  const items = [];
  const rootPath = root.path;
  let exists = false;
  try {
    exists = fs.statSync(rootPath).isDirectory();
  } catch (_) {
    return { root: { ...root, exists: false, count: 0 }, items };
  }
  if (!exists) return { root: { ...root, exists: false, count: 0 }, items };

  const dirs = [];
  const rootSkill = path.join(rootPath, 'SKILL.md');
  if (fs.existsSync(rootSkill)) dirs.push(rootPath);

  let top = [];
  try {
    top = fs.readdirSync(rootPath, { withFileTypes: true });
  } catch (_) {}

  for (const entry of top) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const dir = path.join(rootPath, entry.name);
    if (fs.existsSync(path.join(dir, 'SKILL.md')) || fs.existsSync(path.join(dir, 'skill.md'))) {
      dirs.push(dir);
      continue;
    }
    let children = [];
    try {
      children = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {}
    for (const child of children) {
      if (!child.isDirectory() || child.name.startsWith('.')) continue;
      const nested = path.join(dir, child.name);
      if (fs.existsSync(path.join(nested, 'SKILL.md')) || fs.existsSync(path.join(nested, 'skill.md'))) {
        dirs.push(nested);
      }
    }
  }

  for (const dir of dirs) {
    const file = fs.existsSync(path.join(dir, 'SKILL.md'))
      ? path.join(dir, 'SKILL.md')
      : path.join(dir, 'skill.md');
    try {
      const item = parseSkillFile(file, { rootId: root.id, rootLabel: root.label });
      cache.set(item.id, { path: item.path, rootId: root.id, rootLabel: root.label });
      items.push(item);
    } catch (err) {
      items.push({
        id: shortId(file),
        name: path.basename(dir),
        description: '无法读取 SKILL.md',
        path: file,
        dir,
        rootId: root.id,
        rootLabel: root.label,
        tags: [],
        valid: false,
        error: err.message,
        bytes: 0,
        mtime: 0,
        entries: []
      });
    }
  }
  return { root: { ...root, exists: true, count: items.length }, items };
}

function scan(roots) {
  cache.clear();
  const groups = [];
  const items = [];
  for (const root of roots.filter((r) => r.enabled !== false)) {
    const result = scanRoot(root);
    groups.push(result.root);
    items.push(...result.items);
  }
  lastScanAt = Date.now();
  items.sort((a, b) => b.mtime - a.mtime);
  return { skills: items, roots: groups, scannedAt: lastScanAt };
}

function details(id) {
  const entry = cache.get(id);
  if (!entry) throw new Error('Skill 已变更，请重新扫描');
  if (!fs.existsSync(entry.path)) throw new Error('文件不存在，可能已被移动或删除');
  const raw = fs.readFileSync(entry.path, 'utf8');
  return { id, path: entry.path, content: raw, rootLabel: entry.rootLabel };
}

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function create({ rootId, name, description }) {
  const root = settingsRoot(rootId);
  const title = String(name || '').trim();
  if (!title) throw new Error('请填写 Skill 名称');
  const slug = slugify(title) || `skill-${Date.now()}`;
  const dir = path.join(root.path, slug);
  if (fs.existsSync(dir)) throw new Error(`目录已存在：${dir}`);
  fs.mkdirSync(dir, { recursive: true });
  const desc = String(description || '').trim() || `${title} 的本地 Skill`;
  const content = [
    '---',
    `name: ${title}`,
    `description: ${desc}`,
    '---',
    '',
    `# ${title}`,
    '',
    '## 什么时候用',
    '',
    `- ${desc}`,
    '',
    '## 怎么做',
    '',
    '1. ',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'SKILL.md'), content, 'utf8');
  return { dir, path: path.join(dir, 'SKILL.md') };
}

// 延迟 require，避免 settings 与 skills 的循环依赖
function settingsRoot(rootId) {
  const settings = require('./settings');
  const root = settings.get().roots.find((r) => r.id === rootId);
  if (!root) throw new Error('Skill 目录不存在，请刷新设置');
  fs.mkdirSync(root.path, { recursive: true });
  return root;
}

function save(id, content) {
  const entry = cache.get(id);
  if (!entry) throw new Error('Skill 已变更，请重新扫描');
  const file = entry.path;
  if (!fs.existsSync(file)) throw new Error('文件不存在，可能已被移动或删除');
  backups.backupFile(file, 'skill');
  backups.atomicWrite(file, content);
  return { path: file };
}

module.exports = { scan, details, create, save, parseSkillFile, splitFrontmatter, parseFields };
