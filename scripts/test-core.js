'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const fixtures = path.join(__dirname, '..', 'fixtures', 'home');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skilldock-home-'));
fs.cpSync(fixtures, home, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'skilldock-data-'));
process.env.SKILLDOCK_HOME = home;

// 在纯 Node 下模拟 electron 的 app.getPath，从而直接测试主进程模块
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') {
    return {
      app: {
        getPath: () => userData,
        getVersion: () => '0.1.0',
        setName: () => {}
      }
    };
  }
  return originalLoad.apply(this, arguments);
};

const settings = require('../src/main/settings');
const skills = require('../src/main/skills');
const mcp = require('../src/main/mcp');

function pass(name) {
  console.log(`PASS  ${name}`);
}

const cfg = settings.get();
assert.ok(fs.existsSync(cfg.roots.find((r) => r.label === 'Claude Code').path));
pass('默认路径解析到 ~/.claude/skills');

const scan = skills.scan(cfg.roots);
assert.strictEqual(scan.skills.length, 4, '应扫描到 4 个 fixture Skill');
assert.strictEqual(scan.skills.filter((s) => s.valid).length, 4);
assert.ok(scan.skills.some((s) => s.name === 'api-debugger' && s.tags.includes('debug')));
pass('扫描与 frontmatter 解析');

const claudeRoot = cfg.roots.find((r) => r.label === 'Claude Code');
const created = skills.create({ rootId: claudeRoot.id, name: 'Test Skill', description: '用于验证创建流程' });
assert.ok(fs.existsSync(created.path));
const newContent = fs.readFileSync(created.path, 'utf8');
assert.ok(newContent.includes('name: Test Skill'));
assert.ok(newContent.includes('description: 用于验证创建流程'));
assert.strictEqual(skills.scan(cfg.roots).skills.length, 5);
pass('新建 Skill 生成 frontmatter');

const newId = skills.scan(cfg.roots).skills.find((s) => s.path === created.path).id;
skills.save(newId, newContent + '\n补充一行。\n');
assert.ok(fs.readFileSync(created.path, 'utf8').includes('补充一行。'));
const backups = fs.readdirSync(path.join(userData, 'backups'));
assert.ok(backups.some((f) => f.includes('SKILL.md')), '保存前应生成备份');
pass('保存 SKILL.md 并自动备份');

const clients = mcp.list(cfg.configs);
const claudeCfg = clients.find((c) => c.label === 'Claude Code');
const cursorCfg = clients.find((c) => c.label === 'Cursor');
const codexCfg = clients.find((c) => c.label === 'Codex');
assert.strictEqual(claudeCfg.servers.length, 4, 'Claude 应包含 3 个全局 + 1 个项目级');
assert.ok(claudeCfg.servers.some((s) => s.level === 'project' && s.name === 'supabase'));
assert.strictEqual(cursorCfg.servers.length, 3);
assert.strictEqual(codexCfg.servers.length, 2);
assert.ok(codexCfg.readOnly);
pass('多客户端 MCP 解析（含项目级与 TOML 只读）');

const cursorFile = cursorCfg.path;
const before = fs.readFileSync(cursorFile, 'utf8');
mcp.saveServer({
  configId: cursorCfg.id,
  level: 'global',
  name: 'my-http',
  transport: 'http',
  url: 'https://example.com/mcp',
  headers: { Authorization: 'Bearer test' }
});
const afterObj = JSON.parse(fs.readFileSync(cursorFile, 'utf8'));
assert.strictEqual(afterObj.mcpServers['my-http'].type, 'http');
assert.strictEqual(afterObj.mcpServers['my-http'].url, 'https://example.com/mcp');
assert.strictEqual(afterObj.mcpServers['my-http'].headers.Authorization, 'Bearer test');
assert.ok(fs.readFileSync(cursorFile, 'utf8').includes('\n  "mcpServers"'), '应保留两空格缩进');
assert.ok(fs.readdirSync(path.join(userData, 'backups')).length >= 2);
pass('新增 HTTP MCP 服务并保留缩进与备份');

mcp.saveServer({
  configId: cursorCfg.id,
  level: 'global',
  name: 'my-http-renamed',
  originalName: 'my-http',
  isEdit: true,
  transport: 'stdio',
  command: 'node',
  args: ['server.js'],
  env: { DEBUG: '1' }
});
const renamed = JSON.parse(fs.readFileSync(cursorFile, 'utf8'));
assert.ok(!('my-http' in renamed.mcpServers));
assert.strictEqual(renamed.mcpServers['my-http-renamed'].command, 'node');
assert.deepStrictEqual(renamed.mcpServers['my-http-renamed'].args, ['server.js']);
assert.ok(!('url' in renamed.mcpServers['my-http-renamed']), '切换为 stdio 后应移除 url');
pass('编辑并切换传输方式，旧字段被清理');

mcp.deleteServer({ configId: cursorCfg.id, level: 'global', name: 'my-http-renamed' });
const deleted = JSON.parse(fs.readFileSync(cursorFile, 'utf8'));
assert.ok(!('my-http-renamed' in deleted.mcpServers));
pass('删除 MCP 服务');

const invalidPath = path.join(home, 'invalid.json');
fs.writeFileSync(invalidPath, '{ "mcpServers": { broken } }', 'utf8');
settings.addConfig({ label: 'Broken', path: invalidPath, format: 'json', key: 'mcpServers' });
const brokenEntry = settings.get().configs.find((c) => c.path === invalidPath);
const brokenList = mcp.list(settings.get().configs).find((c) => c.id === brokenEntry.id);
assert.ok(brokenList.parseError.includes('JSON'));
assert.throws(
  () => mcp.saveServer({ configId: brokenEntry.id, level: 'global', name: 'x', transport: 'stdio', command: 'node' }),
  /不是合法 JSON/
);
pass('非法 JSON 拒绝写入');

assert.throws(
  () => mcp.saveServer({ configId: cursorCfg.id, level: 'global', name: 'postgres', transport: 'stdio', command: 'node' }),
  /同名服务/
);
pass('拒绝覆盖同名服务');

assert.throws(
  () => mcp.saveServer({ configId: codexCfg.id, level: 'global', name: 'x', transport: 'stdio', command: 'node' }),
  /TOML/
);
pass('TOML 配置保持只读');

console.log('\n全部核心测试通过');
