'use strict';

const fs = require('fs');
const path = require('path');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(win) {
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const results = [];

  const step = async (name, code, verify) => {
    let value;
    try {
      value = await js(`(() => { ${code} })()`);
    } catch (err) {
      results.push({ name, ok: false, reason: err.message });
      return false;
    }
    await delay(verify.wait || 700);
    let check = value;
    if (verify.check) {
      try {
        check = await js(`(() => { ${verify.check} })()`);
      } catch (err) {
        results.push({ name, ok: false, reason: err.message });
        return false;
      }
    }
    const ok = verify.expect ? verify.expect(check) : !!check;
    results.push({ name, ok, value: check });
    return ok;
  };

  let allOk = true;
  const must = async (name, code, verify) => {
    const ok = await step(name, code, verify);
    if (!ok) allOk = false;
  };

  await must('打开 Skills 视图', `document.querySelector('[data-nav="skills"]').click(); return 'ok';`, {
    wait: 400,
    check: `return !!document.querySelector('.skill-card')`
  });

  await must('打开新增 Skill 弹窗', `document.querySelector('[data-primary]').click(); return !!document.querySelector('.modal-form');`, {
    wait: 400,
    check: `return !!document.querySelector('.modal-form [name="name"]')`
  });

  await must(
    '创建 Skill',
    `const f = document.querySelector('.modal-form');
     f.querySelector('[name="name"]').value = 'E2E Demo';
     f.querySelector('[name="description"]').value = '由自动化测试创建的 Skill';
     f.requestSubmit();
     return 'submitted';`,
    {
      wait: 1000,
      check: `return [...document.querySelectorAll('.skill-card')].some(c => c.textContent.includes('E2E Demo'))`
    }
  );

  const created = await js(`(() => {
    const card = [...document.querySelectorAll('.skill-card')].find(c => c.textContent.includes('E2E Demo'));
    if (!card) return null;
    card.click();
    return card.dataset.skillId;
  })()`);

  await delay(700);
  await must('打开详情并进入编辑', `document.querySelector('[data-edit-skill]').click(); return 'ok';`, {
    wait: 600,
    check: `return !!document.querySelector('.modal-form textarea[name="content"]')`
  });

  await must(
    '保存编辑后的 SKILL.md',
    `const f = document.querySelector('.modal-form');
     const t = f.querySelector('textarea[name="content"]');
     t.value = t.value + '\\n\\n## 自动化测试\\n\\n已保存。\\n';
     f.requestSubmit();
     return 'submitted';`,
    {
      wait: 900,
      check: `return document.querySelector('.modal-overlay') === null || !document.querySelector('#drawer').classList.contains('open')`
    }
  );

  await must('切到 MCP 视图', `document.querySelector('[data-nav="mcp"]').click(); return 'ok';`, {
    wait: 500,
    check: `return !!document.querySelector('[data-new-mcp]')`
  });

  await must(
    '新增 HTTP MCP 服务',
    `document.querySelector('[data-new-mcp]').click();
     const f = document.querySelector('.modal-form');
     f.querySelector('[name="name"]').value = 'e2e-http';
     f.querySelector('[name="transport"]').value = 'http';
     f.querySelector('[name="transport"]').dispatchEvent(new Event('change'));
     f.querySelector('[name="url"]').value = 'https://example.com/e2e';
     f.requestSubmit();
     return 'submitted';`,
    {
      wait: 1000,
      check: `return document.body.textContent.includes('e2e-http')`
    }
  );

  await must(
    '删除刚添加的服务',
    `const row = [...document.querySelectorAll('.mcp-row')].find(r => r.textContent.includes('e2e-http'));
     if (!row) return 'row-missing';
     row.querySelector('[data-mcp-del]').click();
     return 'clicked';`,
    { wait: 600 }
  );

  await must(
    '确认删除',
    `document.querySelector('.modal-form').requestSubmit(); return 'submitted';`,
    {
      wait: 900,
      check: `return ![...document.querySelectorAll('.mcp-row')].some(r => r.textContent.includes('e2e-http'))`
    }
  );

  // 校验磁盘产物
  const home = process.env.SKILLDOCK_HOME || '';
  const skillFile = path.join(home, '.claude', 'skills', 'e2e-demo', 'SKILL.md');
  const skillOk = fs.existsSync(skillFile) && fs.readFileSync(skillFile, 'utf8').includes('## 自动化测试');
  results.push({ name: '磁盘校验：SKILL.md 已写入', ok: skillOk, value: skillFile });

  const backupsDir = path.join(win.__userData || '', 'backups');
  const backupCount = fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir).length : -1;
  results.push({ name: '备份目录已生成副本', ok: backupCount > 0, value: backupCount });

  results.forEach((r) => {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  ← ' + JSON.stringify(r.value || r.reason)}`);
  });

  return allOk && skillOk;
}

module.exports = run;
