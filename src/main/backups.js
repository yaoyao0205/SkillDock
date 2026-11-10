'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const settings = require('./settings');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function backupFile(file, tag = 'config') {
  if (!fs.existsSync(file)) return null;
  const dir = settings.backupDir();
  ensureDir(dir);
  const base = `${stamp()}-${tag}-${path.basename(file).replace(/[^\w.\-]/g, '_')}`;
  const target = path.join(dir, base);
  fs.copyFileSync(file, target);
  prune();
  return target;
}

function prune(keep = 60) {
  const dir = settings.backupDir();
  if (!fs.existsSync(dir)) return;
  const files = fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith('.'))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  files.slice(keep).forEach((item) => {
    try {
      fs.unlinkSync(path.join(dir, item.f));
    } catch (_) {}
  });
}

function sha(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);
}

function atomicWrite(file, content) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.skilldock-${process.pid}.tmp`);
  fs.writeFileSync(tmp, content, 'utf8');
  try {
    const mode = fs.statSync(file).mode;
    fs.chmodSync(tmp, mode);
  } catch (_) {}
  fs.renameSync(tmp, file);
}

module.exports = { backupFile, prune, atomicWrite, sha, ensureDir };
