'use strict';

const api = window.skilldock;

const ICONS = {
  grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  layers: '<svg viewBox="0 0 24 24"><path d="M12 3 2.8 8.2 12 13.4 21.2 8.2 12 3Z"/><path d="m3 12.4 9 5.2 9-5.2"/><path d="m3 16.6 9 5.2 9-5.2"/></svg>',
  plug: '<svg viewBox="0 0 24 24"><path d="M9 7V3"/><path d="M15 7V3"/><path d="M6 7h12v3a6 6 0 0 1-12 0V7Z"/><path d="M12 16v5"/></svg>',
  sliders: '<svg viewBox="0 0 24 24"><path d="M4 6h10"/><path d="M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h4"/><path d="M12 12h8"/><circle cx="10" cy="12" r="2"/><path d="M4 18h12"/><path d="M20 18h0"/><circle cx="18" cy="18" r="2"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5"/><path d="M12 17.5v.5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>',
  external: '<svg viewBox="0 0 24 24"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m6 6 2.5 2.5"/><path d="m15.5 15.5 2.5 2.5"/><path d="m18 6-2.5 2.5"/><path d="m8.5 15.5-2.5 2.5"/></svg>'
};

const state = {
  view: 'overview',
  data: null,
  query: '',
  skillRoot: 'all',
  mcpClient: 'all',
  serverIndex: [],
  loading: true,
  error: ''
};

const VIEW_META = {
  overview: { eyebrow: '工作区', title: '概览', primary: '新增 Skill' },
  skills: { eyebrow: '技能库', title: 'Skills', primary: '新增 Skill' },
  mcp: { eyebrow: '连接', title: 'MCP 服务', primary: '新增服务' },
  settings: { eyebrow: '系统', title: '设置', primary: '重新扫描' }
};

/* ---------------- helpers ---------------- */

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function icon(name, size) {
  const svg = ICONS[name] || '';
  return size ? svg.replace('<svg ', `<svg style="width:${size}px;height:${size}px" `) : svg;
}

function hydrateIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach((el) => {
    const name = el.dataset.icon;
    if (name && ICONS[name] && !el.firstChild) el.innerHTML = ICONS[name];
  });
}

async function call(promise, fallbackMessage) {
  const res = await promise;
  if (!res || !res.ok) throw new Error((res && res.error) || fallbackMessage || '操作失败');
  return res.data;
}

function compactPath(p) {
  if (!p) return '';
  const home = state.data && state.data.home;
  if (home && p.startsWith(home)) {
    const rest = p.slice(home.length).replace(/^\//, '');
    return rest ? `~/${rest}` : '~';
  }
  return p.replace(/^\/(Users|home)\/[^/]+\//, '~/').replace(/^\/root\//, '~/');
}

function fmtTime(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 30 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)} 天前`;
  const d = new Date(ms);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function initials(name) {
  const s = String(name || '?').trim();
  return s ? s[0].toUpperCase() : '?';
}

function matches(text, query) {
  if (!query) return true;
  return String(text || '').toLowerCase().includes(query.toLowerCase());
}

function allSkills() {
  return (state.data && state.data.skills) || [];
}

function roots() {
  return (state.data && state.data.roots) || [];
}

function clients() {
  return (state.data && state.data.clients) || [];
}

function allServers() {
  return clients().flatMap((c) => c.servers.map((s) => ({ ...s, clientLabel: c.label, configId: c.id })));
}

function foundRoots() {
  return roots().filter((r) => r.exists);
}

function writableClients() {
  return clients().filter((c) => c.exists && !c.readOnly && !c.parseError);
}

function showToast(message, type) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' error' : ''}`;
  el.innerHTML = `${icon(type === 'error' ? 'alert' : 'check')}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

/* ---------------- data ---------------- */

async function load() {
  try {
    state.loading = true;
    state.error = '';
    const data = await call(api.loadState(), '无法读取本地配置');
    state.data = data;
    const savedView = data.settings && data.settings.ui && data.settings.ui.lastView;
    if (savedView && VIEW_META[savedView]) state.view = savedView;
    state.loading = false;
    render();
  } catch (err) {
    state.loading = false;
    state.error = err.message;
    render();
  }
}

function applyState(payload) {
  if (payload && payload.settings) {
    state.data = payload;
  }
}

/* ---------------- render ---------------- */

function render() {
  renderChrome();
  renderContent();
}

function renderChrome() {
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.nav === state.view);
  });

  document.body.classList.toggle('is-mac', api.platform === 'darwin');

  const meta = VIEW_META[state.view];
  const subtitleMap = {
    overview: state.data
      ? `${allSkills().length} 个 Skill · ${allServers().length} 个 MCP 服务 · ${clients().filter((c) => c.exists).length} 个客户端配置`
      : '正在读取本地配置',
    skills: '扫描本地目录里的 SKILL.md，查看、检索与直接编辑',
    mcp: '按客户端汇总 MCP 配置，改动会先备份再写回原文件',
    settings: '管理扫描目录与配置文件，查看备份位置'
  };

  document.querySelector('[data-eyebrow]').textContent = meta.eyebrow;
  document.querySelector('[data-title]').textContent = meta.title;
  document.querySelector('[data-subtitle]').textContent = subtitleMap[state.view];
  document.querySelector('[data-primary-label]').textContent = meta.primary;

  const skillCount = document.querySelector('[data-count="skills"]');
  const mcpCount = document.querySelector('[data-count="mcp"]');
  if (skillCount) skillCount.textContent = String(allSkills().length);
  if (mcpCount) mcpCount.textContent = String(allServers().length);

  const version = document.querySelector('[data-version]');
  if (version && state.data) version.textContent = state.data.appVersion || '0.1.0';
}

function renderContent() {
  const content = document.getElementById('content');
  if (state.loading) {
    content.innerHTML = `<div class="stats">
      <div class="stat"><div class="skeleton" style="height:10px;width:50%"></div><div class="skeleton" style="height:26px;width:38%;margin-top:12px"></div></div>
      <div class="stat"><div class="skeleton" style="height:10px;width:50%"></div><div class="skeleton" style="height:26px;width:38%;margin-top:12px"></div></div>
      <div class="stat"><div class="skeleton" style="height:10px;width:50%"></div><div class="skeleton" style="height:26px;width:38%;margin-top:12px"></div></div>
      <div class="stat"><div class="skeleton" style="height:10px;width:50%"></div><div class="skeleton" style="height:26px;width:38%;margin-top:12px"></div></div>
    </div>
    <div class="panel"><div class="panel-body" style="padding:16px"><div class="skeleton" style="height:120px"></div></div></div>`;
    return;
  }
  if (state.error) {
    content.innerHTML = `<div class="empty">
      <div class="empty-icon">${icon('alert')}</div>
      <div class="empty-title">读取失败</div>
      <div class="empty-text">${esc(state.error)}</div>
      <button class="btn" data-retry>${icon('refresh')}重试</button>
    </div>`;
    return;
  }

  if (state.view === 'overview') content.innerHTML = renderOverview();
  else if (state.view === 'skills') content.innerHTML = renderSkills();
  else if (state.view === 'mcp') content.innerHTML = renderMcp();
  else content.innerHTML = renderSettings();
}

function renderOverview() {
  if (state.query) return renderSearchOverview();
  const skillList = allSkills();
  const serverList = allServers();
  const invalid =
    skillList.filter((s) => !s.valid).length +
    clients().filter((c) => c.exists && c.parseError).length;
  const found = foundRoots().length;
  const existingClients = clients().filter((c) => c.exists).length;

  const recent = [...skillList].sort((a, b) => b.mtime - a.mtime).slice(0, 5);
  const recentHtml = recent.length
    ? recent
        .map(
          (s) => `<button class="list-row" data-skill-id="${esc(s.id)}">
            <span class="row-glyph">${esc(initials(s.name))}</span>
            <span class="row-main">
              <span class="row-title">${esc(s.name)}</span>
              <span class="row-sub">${esc(s.rootLabel)} · ${fmtTime(s.mtime)}</span>
            </span>
            <span class="row-end">${s.extraFiles ? s.extraFiles + ' 文件' : ''}</span>
          </button>`
        )
        .join('')
    : `<div class="group-empty">还没有扫描到 Skill，去设置里添加目录。</div>`;

  const serversHtml = serverList.length
    ? serverList
        .slice(0, 6)
        .map(
          (s) => `<button class="list-row" data-goto-mcp>
            <span class="dot ${s.disabled ? 'off' : ''}"></span>
            <span class="row-main">
              <span class="row-title">${esc(s.name)}<span class="transport ${s.transport === 'stdio' ? '' : 'http'}">${esc(s.transport)}</span></span>
              <span class="row-sub">${esc(s.clientLabel)} · ${esc(serverSummary(s))}</span>
            </span>
          </button>`
        )
        .join('')
    : `<div class="group-empty">还没有配置 MCP 服务，点击右上角新增，或手动指定配置文件。</div>`;

  return `
    <div class="stats">
      <div class="stat">
        <div class="stat-label">${icon('layers', 13)}SKILLS</div>
        <div class="stat-value">${skillList.length}</div>
        <div class="stat-foot">来自 <strong>${found}</strong> 个可用目录</div>
      </div>
      <div class="stat">
        <div class="stat-label">${icon('plug', 13)}MCP 服务</div>
        <div class="stat-value">${serverList.length}</div>
        <div class="stat-foot">覆盖 <strong>${existingClients}</strong> 个客户端配置</div>
      </div>
      <div class="stat">
        <div class="stat-label">${icon('sliders', 13)}可写配置</div>
        <div class="stat-value">${writableClients().length}</div>
        <div class="stat-foot">改动前自动备份原文件</div>
      </div>
      <div class="stat ${invalid ? 'glow-amber' : ''}">
        <div class="stat-label">${icon('alert', 13)}待处理</div>
        <div class="stat-value">${invalid}</div>
        <div class="stat-foot">${invalid ? '存在无法解析的文件' : '所有文件均可正常解析'}</div>
      </div>
    </div>

    <div class="panels">
      <div class="panel">
        <div class="panel-head">
          <div class="panel-title">${icon('spark')}最近更新</div>
          <button class="link-btn" data-nav="skills">查看全部 ${icon('arrow')}</button>
        </div>
        <div class="panel-body">${recentHtml}</div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <div class="panel-title">${icon('plug')}MCP 服务</div>
          <span class="panel-sub">${serverList.length} 个已配置</span>
        </div>
        <div class="panel-body">${serversHtml}</div>
      </div>
    </div>

    <div class="banner">
      ${icon('shield')}
      <div class="banner-text"><strong>写入有据可查。</strong> 每次修改 SKILL.md 或 MCP 配置，都会先在备份目录留一份带时间戳的副本；JSON 解析失败时应用会拒绝写入。</div>
      <button class="btn small" data-open-path="${esc(state.data.backupDir)}">${icon('folder')}备份目录</button>
    </div>`;
}

function renderSearchOverview() {
  const q = state.query;
  const skillHits = allSkills().filter((s) => matches(s.name + ' ' + s.description + ' ' + s.path + ' ' + s.tags.join(' '), q));
  const serverHits = allServers().filter((s) =>
    matches(s.name + ' ' + s.command + ' ' + s.url + ' ' + s.clientLabel, q)
  );
  const rows = [
    ...skillHits.slice(0, 8).map(
      (s) => `<button class="list-row" data-skill-id="${esc(s.id)}">
        <span class="row-glyph">${esc(initials(s.name))}</span>
        <span class="row-main"><span class="row-title">${esc(s.name)}</span><span class="row-sub">Skill · ${esc(compactPath(s.path))}</span></span>
      </button>`
    ),
    ...serverHits.slice(0, 8).map(
      (s) => `<div class="list-row" style="cursor:default">
        <span class="dot ${s.disabled ? 'off' : ''}"></span>
        <span class="row-main"><span class="row-title">${esc(s.name)}<span class="transport ${s.transport === 'stdio' ? '' : 'http'}">${esc(s.transport)}</span></span><span class="row-sub">MCP · ${esc(s.clientLabel)} · ${esc(s.command || s.url)}</span></span>
      </div>`
    )
  ].join('');

  return `
    <div class="toolbar"><span class="result-count">“${esc(q)}” 的搜索结果 · ${skillHits.length + serverHits.length} 项</span></div>
    <div class="panel"><div class="panel-body">${rows || `<div class="group-empty">没有匹配的结果</div>`}</div></div>`;
}

function renderSkillCard(s) {
  const tags = s.tags.slice(0, 2).map((t) => `<span class="meta-tag">${esc(t)}</span>`).join('');
  return `<button class="skill-card${s.valid ? '' : ' invalid'}" data-skill-id="${esc(s.id)}">
    <div class="skill-head">
      <span class="skill-glyph">${esc(initials(s.name))}</span>
      <div style="min-width:0;flex:1">
        <div class="skill-name">${esc(s.name)}</div>
        <div class="skill-source">${esc(s.rootLabel)} · ${fmtTime(s.mtime)}</div>
      </div>
    </div>
    <p class="skill-desc">${esc(s.description || '暂无描述，打开后可补充 frontmatter。')}</p>
    <div class="skill-meta">
      ${tags}
      ${tags ? '<span class="meta-sep"></span>' : ''}
      <span>${s.extraFiles ? s.extraFiles + ' 个附带文件' : '仅 SKILL.md'}</span>
      ${s.valid ? '' : '<span class="meta-tag warn">解析异常</span>'}
    </div>
  </button>`;
}

function renderSkills() {
  const q = state.query;
  if (state.skillRoot !== 'all' && !roots().some((r) => r.id === state.skillRoot)) state.skillRoot = 'all';
  const list = allSkills().filter((s) => {
    const rootOk = state.skillRoot === 'all' || s.rootId === state.skillRoot;
    const qOk = matches(s.name + ' ' + s.description + ' ' + s.path + ' ' + s.tags.join(' '), q);
    return rootOk && qOk;
  });

  const chips = [
    `<button class="chip ${state.skillRoot === 'all' ? 'active' : ''}" data-skill-root="all">全部 <span class="chip-count">${allSkills().length}</span></button>`,
    ...foundRoots().map(
      (r) =>
        `<button class="chip ${state.skillRoot === r.id ? 'active' : ''}" data-skill-root="${esc(r.id)}">${esc(r.label)} <span class="chip-count">${r.count}</span></button>`
    )
  ].join('');

  let body;
  if (!foundRoots().length) {
    body = `<div class="empty">
      <div class="empty-icon">${icon('folder')}</div>
      <div class="empty-title">还没有可用的 Skill 目录</div>
      <div class="empty-text">默认会检查 ~/.claude/skills、~/.agents/skills、~/.codex/skills 等常见位置。你可以直接指定任意包含 SKILL.md 的目录。</div>
      <button class="btn" data-add-root>${icon('plus')}添加目录</button>
    </div>`;
  } else if (!list.length) {
    body = `<div class="empty">
      <div class="empty-icon">${icon('search')}</div>
      <div class="empty-title">没有匹配的 Skill</div>
      <div class="empty-text">换个关键词，或切换到其他目录；也可以新建一个带 frontmatter 的 SKILL.md。</div>
      <button class="btn" data-new-skill>${icon('plus')}新增 Skill</button>
    </div>`;
  } else {
    body = `<div class="skill-grid">${list.map(renderSkillCard).join('')}</div>`;
  }

  return `
    <div class="toolbar">
      <div class="chips">${chips}</div>
      <div class="toolbar-spacer"></div>
      <span class="result-count">${list.length} 个 Skill</span>
    </div>
    ${body}`;
}

function serverSummary(s) {
  if (s.transport === 'stdio') {
    if (!s.command) return '未填写 command';
    const args = (s.args || []).join(' ');
    return args ? `${s.command} ${args}` : s.command;
  }
  return s.url || '未填写 url';
}

function renderMcp() {
  const q = state.query;
  const list = clients();
  state.serverIndex = [];

  const chips = [
    `<button class="chip ${state.mcpClient === 'all' ? 'active' : ''}" data-mcp-client="all">全部 <span class="chip-count">${allServers().length}</span></button>`,
    ...list
      .filter((c) => c.exists)
      .map(
        (c) =>
          `<button class="chip ${state.mcpClient === c.id ? 'active' : ''}" data-mcp-client="${esc(c.id)}">${esc(c.label)} <span class="chip-count">${c.servers.length}</span></button>`
      )
  ].join('');

  const groups = list
    .filter((c) => c.exists)
    .filter((c) => state.mcpClient === 'all' || c.id === state.mcpClient)
    .map((c) => {
      const servers = c.servers.filter((s) =>
        matches(s.name + ' ' + s.command + ' ' + s.url + ' ' + s.clientLabel + ' ' + (s.projectPath || ''), q)
      );
      const writable = !c.readOnly && !c.parseError;
      const statusBadge = c.parseError
        ? `<span class="badge bad">解析失败</span>`
        : `<span class="badge ok">已找到</span>${c.readOnly ? '<span class="badge plain">只读</span>' : ''}`;

      const rows = servers.length
        ? servers
            .map((s) => {
              const token = `srv-${state.serverIndex.length}`;
              state.serverIndex.push({
                token,
                configId: c.id,
                level: s.level,
                projectPath: s.projectPath,
                name: s.name,
                readOnly: c.readOnly || c.parseError,
                clientLabel: c.label,
                server: s
              });
              return `<div class="mcp-row">
                <span class="dot ${s.disabled ? 'off' : ''}" title="${s.disabled ? '配置中被标记为禁用' : '已配置'}"></span>
                <div class="mcp-main">
                  <div class="mcp-name">${esc(s.name)}
                    <span class="transport ${s.transport === 'stdio' ? '' : 'http'}">${esc(s.transport)}</span>
                    ${s.level === 'project' ? `<span class="level-tag">项目级 · ${esc(compactPath(s.projectPath))}</span>` : ''}
                    ${s.disabled ? '<span class="badge warn">已禁用</span>' : ''}
                  </div>
                  <div class="mcp-cmd">${esc(serverSummary(s))}</div>
                </div>
                <div class="mcp-actions">
                  ${
                    c.readOnly || c.parseError
                      ? `<span class="badge plain">${c.parseError ? '无法编辑' : 'TOML 只读'}</span>`
                      : `<button class="mini-btn" data-mcp-edit="${token}">${icon('edit')}编辑</button>
                         <button class="mini-btn danger" data-mcp-del="${token}" title="删除服务">${icon('trash')}</button>`
                  }
                </div>
              </div>`;
            })
            .join('')
        : `<div class="group-empty">${c.parseError ? esc(c.parseError) : c.note ? esc(c.note) : '这个配置里还没有 MCP 服务。'}</div>`;

      return `<div class="client-group">
        <div class="client-head">
          <div class="client-id"><span class="client-name">${esc(c.label)}</span>${statusBadge}</div>
          <div class="client-path" title="${esc(c.path)}">${esc(compactPath(c.path))}</div>
          <div class="client-actions">
            ${writable ? `<button class="btn small" data-new-mcp="${esc(c.id)}">${icon('plus')}新增</button>` : ''}
            <button class="btn small icon-only" data-reveal="${esc(c.path)}" title="在 Finder 中显示配置文件">${icon('folder')}</button>
          </div>
        </div>
        <div class="client-body">${rows}</div>
      </div>`;
    })
    .join('');

  const missing = list.filter((c) => !c.exists);
  const missingNote = missing.length
    ? `<div class="toolbar" style="margin-top:2px"><span class="result-count">另有 ${missing.length} 个常见客户端配置未找到：${missing
        .map((c) => esc(c.label))
        .join('、')}。可在设置中核对路径。</span></div>`
    : '';

  if (!groups) {
    return `
      <div class="toolbar"><div class="chips">${chips}</div></div>
      <div class="empty">
        <div class="empty-icon">${icon('plug')}</div>
        <div class="empty-title">没有找到可用的 MCP 配置</div>
        <div class="empty-text">应用会检查 ~/.claude.json、Claude Desktop、Cursor、Codex 等常见位置。若客户端装在别处，可在设置里手动指定配置文件。</div>
        <button class="btn" data-add-config>${icon('plus')}添加配置文件</button>
      </div>
      ${missingNote}`;
  }

  return `<div class="toolbar"><div class="chips">${chips}</div></div>${groups}${missingNote}`;
}

function renderSettings() {
  const data = state.data;
  const rootRows = roots()
    .map(
      (r) => `<div class="settings-row">
        <span class="dot ${r.exists ? '' : 'muted'}"></span>
        <div class="settings-main">
          <div class="settings-label">${esc(r.label)} ${r.exists ? '' : '<span class="badge plain">未找到</span>'}</div>
          <div class="settings-path" title="${esc(r.path)}">${esc(compactPath(r.path))}</div>
        </div>
        <div class="settings-meta">
          <span>${r.exists ? r.count + ' 个 Skill' : '目录不存在'}</span>
          <button class="mini-btn" data-open-path="${esc(r.path)}" title="打开目录">${icon('folder')}</button>
          <button class="mini-btn danger" data-root-remove="${esc(r.id)}" title="从列表移除">${icon('trash')}</button>
        </div>
      </div>`
    )
    .join('');

  const configRows = clients()
    .map(
      (c) => `<div class="settings-row">
        <span class="dot ${c.exists ? (c.parseError ? 'bad' : '') : 'muted'}"></span>
        <div class="settings-main">
          <div class="settings-label">${esc(c.label)}
            <span class="badge plain">${esc(c.format.toUpperCase())}</span>
            ${c.exists ? (c.parseError ? '<span class="badge bad">解析失败</span>' : '<span class="badge ok">已找到</span>') : '<span class="badge plain">未找到</span>'}
          </div>
          <div class="settings-path" title="${esc(c.path)}">${esc(compactPath(c.path))}</div>
        </div>
        <div class="settings-meta">
          <span>${c.exists ? c.servers.length + ' 个服务' : '文件不存在'}</span>
          <button class="mini-btn" data-reveal="${esc(c.path)}" title="在 Finder 中显示">${icon('folder')}</button>
          <button class="mini-btn danger" data-config-remove="${esc(c.id)}" title="从列表移除">${icon('trash')}</button>
        </div>
      </div>`
    )
    .join('');

  return `
    <div class="section">
      <div class="section-head">
        <div>
          <div class="section-title">Skill 目录</div>
          <div class="section-desc">每个目录下的一级或二级文件夹若包含 SKILL.md，就会被识别为一个 Skill。</div>
        </div>
        <button class="btn small" data-add-root>${icon('plus')}添加目录</button>
      </div>
      ${rootRows}
    </div>

    <div class="section">
      <div class="section-head">
        <div>
          <div class="section-title">MCP 配置文件</div>
          <div class="section-desc">JSON 配置支持在应用内编辑与新增；TOML（Codex）仅做只读解析，避免破坏文件格式。</div>
        </div>
        <button class="btn small" data-add-config>${icon('plus')}添加文件</button>
      </div>
      ${configRows}
    </div>

    <div class="section">
      <div class="section-head">
        <div>
          <div class="section-title">数据与备份</div>
          <div class="section-desc">所有本地数据保存在应用数据目录，不上传任何内容。</div>
        </div>
        <button class="btn small" data-rescan>${icon('refresh')}重新扫描</button>
      </div>
      <div class="settings-row">
        <span class="dot"></span>
        <div class="settings-main">
          <div class="settings-label">应用数据目录</div>
          <div class="settings-path">${esc(compactPath(data.dataDir))}</div>
        </div>
        <div class="settings-meta"><button class="mini-btn" data-open-path="${esc(data.dataDir)}">${icon('folder')}打开</button></div>
      </div>
      <div class="settings-row">
        <span class="dot"></span>
        <div class="settings-main">
          <div class="settings-label">备份目录 <span class="badge plain">最多保留 60 份</span></div>
          <div class="settings-path">${esc(compactPath(data.backupDir))}</div>
        </div>
        <div class="settings-meta"><button class="mini-btn" data-open-path="${esc(data.backupDir)}">${icon('folder')}打开</button></div>
      </div>
      <div class="settings-row">
        <span class="dot muted"></span>
        <div class="settings-main">
          <div class="settings-label">设置文件</div>
          <div class="settings-path">${esc(compactPath(data.dataDir + '/settings.json'))}</div>
        </div>
        <div class="settings-meta"><span>SkillDock v${esc(data.appVersion || '0.1.0')}</span></div>
      </div>
    </div>`;
}

/* ---------------- drawer ---------------- */

function openSkill(id) {
  const skill = allSkills().find((s) => s.id === id);
  if (!skill) return;
  const drawer = document.getElementById('drawer');
  drawer.innerHTML = `
    <div class="drawer-backdrop" data-close-drawer></div>
    <aside class="drawer-panel">
      <div class="drawer-head">
        <span class="skill-glyph" style="width:40px;height:40px;border-radius:11px;font-size:16px">${esc(initials(skill.name))}</span>
        <div class="drawer-title">
          <div class="skill-source">${esc(skill.rootLabel)}${skill.version ? ' · ' + esc(skill.version) : ''}</div>
          <h2>${esc(skill.name)}</h2>
        </div>
        <button class="modal-close" data-close-drawer title="关闭">${icon('x')}</button>
      </div>
      <div class="drawer-body">
        <p class="desc-text">${esc(skill.description || '暂无描述')}</p>
        <div class="path-box">${icon('folder')}<span>${esc(compactPath(skill.path))}</span></div>
        <div class="preview-label">SKILL.MD 预览</div>
        <div class="markdown" id="skill-preview"><div class="skeleton" style="height:14px;width:60%"></div><div class="skeleton" style="height:14px;width:90%;margin-top:8px"></div><div class="skeleton" style="height:14px;width:75%;margin-top:8px"></div></div>
      </div>
      <div class="drawer-actions">
        <button class="btn small" data-reveal="${esc(skill.path)}">${icon('external')}在 Finder 显示</button>
        <button class="btn small" data-copy="${esc(skill.path)}">${icon('copy')}复制路径</button>
        <button class="btn small primary" data-edit-skill="${esc(skill.id)}">${icon('edit')}编辑</button>
      </div>
    </aside>`;
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  hydrateIcons(drawer);

  call(api.readSkill(id), '读取 SKILL.md 失败')
    .then((data) => {
      const preview = document.getElementById('skill-preview');
      if (preview) preview.innerHTML = renderMarkdown(data.content);
    })
    .catch((err) => {
      const preview = document.getElementById('skill-preview');
      if (preview) preview.innerHTML = `<div class="form-error show">${esc(err.message)}</div>`;
    });
}

function closeDrawer() {
  const drawer = document.getElementById('drawer');
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    if (!drawer.classList.contains('open')) drawer.innerHTML = '';
  }, 240);
}

/* ---------------- markdown ---------------- */

function inlineFormat(text) {
  return text
    .replace(/`([^`]+?)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" data-external="$2">$1</a>');
}

function renderMarkdown(md) {
  const body = String(md || '').replace(/^---[\s\S]*?---\r?\n/, '');
  const lines = body.split(/\r?\n/);
  const html = [];
  let listType = null;
  let paragraph = [];
  let code = null;
  let codeLang = '';

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineFormat(esc(paragraph.join(' ')))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };
  const openList = (type) => {
    if (listType !== type) {
      closeList();
      html.push(`<${type}>`);
      listType = type;
    }
  };

  for (const raw of lines) {
    const line = raw;
    if (code !== null) {
      if (/^\s*```/.test(line)) {
        html.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
        code = null;
        codeLang = '';
      } else {
        code.push(line);
      }
      continue;
    }
    if (/^\s*```/.test(line)) {
      flushParagraph();
      closeList();
      code = [];
      codeLang = line.replace(/^\s*```/, '').trim();
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineFormat(esc(heading[2].trim()))}</h${level}>`);
      continue;
    }
    const item = line.match(/^\s*([-*+]|\d+\.)\s+(.*)$/);
    if (item) {
      flushParagraph();
      const type = /^\d/.test(item[1]) ? 'ol' : 'ul';
      openList(type);
      html.push(`<li>${inlineFormat(esc(item[2].trim()))}</li>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushParagraph();
      closeList();
      html.push(`<p style="border-left:2px solid var(--line-strong);padding-left:10px;color:var(--faint)">${inlineFormat(
        esc(line.replace(/^>\s?/, ''))
      )}</p>`);
      continue;
    }
    paragraph.push(line.trim());
  }
  if (code !== null) html.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
  flushParagraph();
  closeList();
  return html.join('\n');
}

/* ---------------- modals ---------------- */

function closeModal() {
  const root = document.getElementById('modal-root');
  const overlay = root.querySelector('.modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('show');
  setTimeout(() => {
    if (!overlay.classList.contains('show')) root.innerHTML = '';
  }, 170);
}

function openModal(options) {
  const {
    title,
    subtitle = '',
    body = '',
    submitText = '保存',
    cancelText = '取消',
    danger = false,
    wide = false,
    hideSubmit = false,
    onSubmit = null,
    onMount = null
  } = options;
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            <h2>${esc(title)}</h2>
            ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
          </div>
          <button type="button" class="modal-close" data-modal-close title="关闭">${icon('x')}</button>
        </div>
        <form class="modal-form" novalidate>
          <div class="modal-body">
            <div class="form-error" data-form-error></div>
            ${body}
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" data-modal-close>${esc(cancelText)}</button>
            ${hideSubmit ? '' : `<button type="submit" class="btn ${danger ? 'danger' : 'primary'}" data-submit>${esc(submitText)}</button>`}
          </div>
        </form>
      </div>
    </div>`;
  hydrateIcons(root);

  const overlay = root.querySelector('.modal-overlay');
  const form = root.querySelector('form');
  requestAnimationFrame(() => {
    overlay.classList.add('show');
    const first = form.querySelector('input:not([type="hidden"]), textarea, select');
    if (first) first.focus();
  });

  root.querySelectorAll('[data-modal-close]').forEach((btn) => btn.addEventListener('click', closeModal));
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closeModal();
  });

  if (onMount) onMount(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!onSubmit) return;
    const submitBtn = form.querySelector('[data-submit]');
    const errorBox = form.querySelector('[data-form-error]');
    if (errorBox) errorBox.classList.remove('show');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.original = submitBtn.textContent;
      submitBtn.textContent = '处理中…';
    }
    try {
      await onSubmit(form);
    } catch (err) {
      if (errorBox) {
        errorBox.textContent = err.message;
        errorBox.classList.add('show');
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.original || submitText;
      }
    }
  });
}

function kvRows(values) {
  const entries = Object.entries(values || {});
  if (!entries.length) return '';
  return entries
    .map(
      ([k, v]) => `<div class="kv-row">
        <input class="input kv-key" value="${esc(k)}" placeholder="KEY" spellcheck="false" />
        <input class="input kv-val" value="${esc(v)}" placeholder="value" spellcheck="false" />
        <button type="button" class="kv-remove" data-remove-kv title="删除">${icon('x')}</button>
      </div>`
    )
    .join('');
}

function collectKv(form, name) {
  const list = form.querySelector(`[data-kv="${name}"]`);
  const result = {};
  if (!list) return result;
  list.querySelectorAll('.kv-row').forEach((row) => {
    const key = row.querySelector('.kv-key').value.trim();
    const val = row.querySelector('.kv-val').value;
    if (key) result[key] = val;
  });
  return result;
}

function bindKv(form) {
  form.querySelectorAll('[data-add-kv]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const list = form.querySelector(`[data-kv="${btn.dataset.addKv}"]`);
      if (!list) return;
      const div = document.createElement('div');
      div.className = 'kv-row';
      div.innerHTML = `<input class="input kv-key" placeholder="KEY" spellcheck="false" /><input class="input kv-val" placeholder="value" spellcheck="false" /><button type="button" class="kv-remove" data-remove-kv title="删除">${icon('x')}</button>`;
      list.appendChild(div);
      div.querySelector('.kv-key').focus();
    });
  });
  form.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-kv]');
    if (btn) btn.closest('.kv-row').remove();
  });
}

function bindBrowse(form) {
  form.querySelectorAll('[data-browse]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const input = form.querySelector(`[name="${btn.dataset.browseTarget}"]`);
      if (!input) return;
      const picked = btn.dataset.browse === 'dir' ? await call(api.pickDir()) : await call(api.pickFile());
      if (picked) input.value = picked;
    });
  });
}

function openNewSkillModal() {
  const available = foundRoots();
  if (!available.length) {
    showToast('先在设置里添加一个 Skill 目录', 'error');
    setView('settings');
    return;
  }
  const options = available
    .map((r) => `<option value="${esc(r.id)}">${esc(r.label)} · ${esc(compactPath(r.path))}</option>`)
    .join('');
  openModal({
    title: '新增 Skill',
    subtitle: '会在所选目录下创建一个文件夹和带 frontmatter 的 SKILL.md。',
    submitText: '创建',
    body: `
      <div class="field">
        <label class="label">目标目录</label>
        <select class="select" name="rootId">${options}</select>
      </div>
      <div class="field">
        <label class="label">名称</label>
        <input class="input" name="name" placeholder="例如：接口联调助手" />
      </div>
      <div class="field">
        <label class="label">描述<span class="hint">写清楚它解决什么问题、什么时候用</span></label>
        <textarea class="textarea" name="description" rows="4" placeholder="当需要……时使用，它会……"></textarea>
      </div>
      <div class="note">目录名会自动转成小写短横线格式；创建后可在详情里继续编辑正文。</div>`,
    onSubmit: async (form) => {
      const payload = {
        rootId: form.rootId.value,
        name: form.name.value.trim(),
        description: form.description.value.trim()
      };
      if (!payload.name) throw new Error('请填写 Skill 名称');
      const result = await call(api.createSkill(payload), '创建失败');
      applyState(result.state);
      closeModal();
      render();
      setView('skills');
      showToast(`已创建 ${payload.name}`);
    }
  });
}

function mcpFormBody(server, presetConfigId) {
  const configOptions = clients()
    .filter((c) => !c.readOnly)
    .map(
      (c) =>
        `<option value="${esc(c.id)}" ${c.id === presetConfigId ? 'selected' : ''}>${esc(c.label)} · ${esc(compactPath(c.path))}${c.exists ? '' : '（将新建文件）'}</option>`
    )
    .join('');
  const transport = (server && server.transport) || 'stdio';
  return `
    <div class="field">
      <label class="label">写入位置</label>
      <select class="select" name="configId" ${server ? 'disabled' : ''}>${configOptions}</select>
      ${server && server.level === 'project' ? `<div class="note">这是项目级配置：${esc(server.projectPath)}</div>` : ''}
    </div>
    <div class="field">
      <label class="label">服务名称<span class="hint">字母、数字、点、下划线或短横线</span></label>
      <input class="input" name="name" value="${esc((server && server.name) || '')}" placeholder="例如：github" spellcheck="false" />
    </div>
    <div class="field">
      <label class="label">传输方式</label>
      <select class="select" name="transport">
        <option value="stdio" ${transport === 'stdio' ? 'selected' : ''}>stdio（本地进程）</option>
        <option value="http" ${transport === 'http' ? 'selected' : ''}>http（远程服务）</option>
        <option value="sse" ${transport === 'sse' ? 'selected' : ''}>sse（远程服务）</option>
      </select>
    </div>
    <div data-transport="stdio">
      <div class="field">
        <label class="label">启动命令</label>
        <input class="input" name="command" value="${esc((server && server.command) || '')}" placeholder="npx" spellcheck="false" />
      </div>
      <div class="field">
        <label class="label">参数<span class="hint">每行一个</span></label>
        <textarea class="textarea" name="args" rows="3" placeholder="-y&#10;@modelcontextprotocol/server-github" spellcheck="false">${esc(
          (server && (server.args || []).join('\n')) || ''
        )}</textarea>
      </div>
      <div class="field">
        <label class="label">环境变量</label>
        <div class="kv-list" data-kv="env">${kvRows((server && server.env) || {})}</div>
        <button type="button" class="link-btn" data-add-kv="env">${icon('plus')}添加变量</button>
      </div>
    </div>
    <div data-transport="http">
      <div class="field">
        <label class="label">服务 URL</label>
        <input class="input" name="url" value="${esc((server && server.url) || '')}" placeholder="https://example.com/mcp" spellcheck="false" />
      </div>
      <div class="field">
        <label class="label">请求头<span class="hint">可选，如 Authorization</span></label>
        <div class="kv-list" data-kv="headers">${kvRows((server && server.headers) || {})}</div>
        <button type="button" class="link-btn" data-add-kv="headers">${icon('plus')}添加请求头</button>
      </div>
    </div>`;
}

function applyTransportVisibility(form, value) {
  form.querySelectorAll('[data-transport]').forEach((block) => {
    const show = block.dataset.transport === value;
    block.style.display = show ? '' : 'none';
    block.querySelectorAll('input, textarea').forEach((input) => {
      input.disabled = !show;
    });
  });
}

function bindTransport(form) {
  const select = form.querySelector('[name="transport"]');
  if (!select) return;
  const update = () => applyTransportVisibility(form, select.value);
  select.addEventListener('change', update);
  update();
}

function openMcpModal(existing, presetConfigId) {
  const configs = clients().filter((c) => !c.readOnly);
  if (!configs.length) {
    showToast('没有可写的 JSON 配置文件', 'error');
    return;
  }
  const targetConfig = existing ? configs.find((c) => c.id === existing.configId) : null;
  openModal({
    title: existing ? '编辑 MCP 服务' : '新增 MCP 服务',
    subtitle: existing
      ? `${existing.clientLabel} · 保存后写回原文件，并先备份一份副本。`
      : '选择要写入的客户端配置，填写启动方式。',
    submitText: existing ? '保存修改' : '添加服务',
    wide: true,
    body: mcpFormBody(existing ? existing.server : null, presetConfigId),
    onMount: (form) => {
      bindKv(form);
      bindTransport(form);
      if (targetConfig && targetConfig.readOnly) {
        form.querySelector('[name="configId"]').disabled = true;
      }
    },
    onSubmit: async (form) => {
      const name = form.name.value.trim();
      if (!name) throw new Error('请填写服务名称');
      if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error('服务名称只能包含字母、数字、点、下划线和短横线');
      const transport = form.transport.value;
      const payload = {
        configId: existing ? existing.configId : form.configId.value,
        level: existing ? existing.level : 'global',
        projectPath: existing ? existing.projectPath : '',
        name,
        originalName: existing ? existing.name : name,
        isEdit: !!existing,
        transport,
        command: form.command ? form.command.value.trim() : '',
        args: form.args ? form.args.value.split('\n').map((s) => s.trim()).filter(Boolean) : [],
        env: collectKv(form, 'env'),
        url: form.url ? form.url.value.trim() : '',
        headers: collectKv(form, 'headers')
      };
      if (transport === 'stdio' && !payload.command) throw new Error('stdio 方式必须填写启动命令');
      if (transport !== 'stdio' && !payload.url) throw new Error('远程方式必须填写服务 URL');
      const result = await call(api.saveMcp(payload), '写入失败');
      applyState(result.state);
      closeModal();
      render();
      showToast(existing ? '已保存修改' : `已添加 ${name}`);
    }
  });
}

function openDeleteMcpModal(token) {
  const target = state.serverIndex.find((s) => s.token === token);
  if (!target) return;
  openModal({
    title: '删除 MCP 服务',
    subtitle: `${target.clientLabel}${target.level === 'project' ? ' · 项目级配置' : ''}`,
    submitText: '删除',
    danger: true,
    body: `<p class="desc-text">确定要删除 <strong style="color:var(--text)">${esc(target.name)}</strong> 吗？这会从配置文件中移除该条目，并在删除前自动备份原文件。</p>
      <div class="path-box">${icon('folder')}<span>${esc(compactPath(target.server.url || target.server.command || ''))}</span></div>`,
    onSubmit: async () => {
      const result = await call(
        api.deleteMcp({
          configId: target.configId,
          level: target.level,
          projectPath: target.projectPath,
          name: target.name
        }),
        '删除失败'
      );
      applyState(result.state);
      closeModal();
      render();
      showToast(`已删除 ${target.name}`);
    }
  });
}

function openEditSkillModal(id) {
  const skill = allSkills().find((s) => s.id === id);
  if (!skill) return;
  call(api.readSkill(id), '读取失败')
    .then((data) => {
      openModal({
        title: '编辑 SKILL.md',
        subtitle: `${skill.rootLabel} · ${compactPath(skill.path)}`,
        submitText: '保存',
        wide: true,
        body: `<div class="field">
          <label class="label">文件内容<span class="hint">保存前会自动备份</span></label>
          <textarea class="textarea tall" name="content" spellcheck="false">${esc(data.content)}</textarea>
        </div>`,
        onSubmit: async (form) => {
          await call(api.saveSkill({ id, content: form.content.value }), '保存失败');
          closeModal();
          closeDrawer();
          await rescan();
          showToast('SKILL.md 已保存');
        }
      });
    })
    .catch((err) => showToast(err.message, 'error'));
}

function openAddRootModal() {
  openModal({
    title: '添加 Skill 目录',
    subtitle: '目录本身或它的一级/二级子目录中包含 SKILL.md 即可被识别。',
    submitText: '添加',
    body: `
      <div class="field">
        <label class="label">目录路径</label>
        <div class="input-with-btn">
          <input class="input" name="path" placeholder="~/.skills 或 /Users/you/skills" spellcheck="false" />
          <button type="button" class="btn" data-browse="dir" data-browse-target="path">${icon('folder')}浏览</button>
        </div>
      </div>
      <div class="field">
        <label class="label">显示名称<span class="hint">可选</span></label>
        <input class="input" name="label" placeholder="例如：团队技能库" />
      </div>`,
    onMount: bindBrowse,
    onSubmit: async (form) => {
      const result = await call(
        api.addRoot({ path: form.path.value.trim(), label: form.label.value.trim() }),
        '添加失败'
      );
      applyState(result);
      closeModal();
      render();
      showToast('目录已添加');
    }
  });
}

function openAddConfigModal() {
  openModal({
    title: '添加 MCP 配置文件',
    subtitle: '支持 JSON（mcpServers / servers）与 TOML（mcp_servers，只读）。',
    submitText: '添加',
    body: `
      <div class="field">
        <label class="label">配置文件路径</label>
        <div class="input-with-btn">
          <input class="input" name="path" placeholder="~/.cursor/mcp.json" spellcheck="false" />
          <button type="button" class="btn" data-browse="file" data-browse-target="path">${icon('folder')}浏览</button>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="label">显示名称</label>
          <input class="input" name="label" placeholder="例如：公司 MCP" />
        </div>
        <div class="field">
          <label class="label">格式</label>
          <select class="select" name="format">
            <option value="json">JSON</option>
            <option value="toml">TOML（只读）</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label class="label">服务字段名<span class="hint">JSON 一般是 mcpServers，VS Code 是 servers</span></label>
        <input class="input" name="key" value="mcpServers" spellcheck="false" />
      </div>`,
    onMount: (form) => {
      bindBrowse(form);
      form.format.addEventListener('change', () => {
        form.key.value = form.format.value === 'toml' ? 'mcp_servers' : 'mcpServers';
      });
    },
    onSubmit: async (form) => {
      const result = await call(
        api.addConfig({
          path: form.path.value.trim(),
          label: form.label.value.trim(),
          format: form.format.value,
          key: form.key.value.trim()
        }),
        '添加失败'
      );
      applyState(result);
      closeModal();
      render();
      showToast('配置文件已添加');
    }
  });
}

/* ---------------- actions ---------------- */

async function rescan() {
  try {
    const data = await call(api.rescan(), '扫描失败');
    state.data = data;
    render();
    showToast('已重新扫描');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setView(view) {
  if (!VIEW_META[view]) return;
  state.view = view;
  state.query = view === 'settings' ? '' : state.query;
  const input = document.getElementById('search');
  if (input) input.value = state.query;
  closeDrawer();
  render();
  document.getElementById('content').scrollTop = 0;
  api.rememberView(view);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制路径');
  } catch (_) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('已复制路径');
    } catch (e) {
      showToast('复制失败', 'error');
    }
    ta.remove();
  }
}

/* ---------------- events ---------------- */

function bindEvents() {
  document.addEventListener('click', async (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      setView(nav.dataset.nav);
      return;
    }

    const closeDrawerBtn = e.target.closest('[data-close-drawer]');
    if (closeDrawerBtn) {
      closeDrawer();
      return;
    }

    const skillCard = e.target.closest('[data-skill-id]');
    if (skillCard) {
      openSkill(skillCard.dataset.skillId);
      return;
    }

    if (e.target.closest('[data-goto-mcp]')) {
      setView('mcp');
      return;
    }

    const editSkill = e.target.closest('[data-edit-skill]');
    if (editSkill) {
      openEditSkillModal(editSkill.dataset.editSkill);
      return;
    }

    if (e.target.closest('[data-new-skill]')) {
      openNewSkillModal();
      return;
    }

    const newMcp = e.target.closest('[data-new-mcp]');
    if (newMcp) {
      openMcpModal(null, newMcp.dataset.newMcp);
      return;
    }

    if (e.target.closest('[data-primary]')) {
      if (state.view === 'skills' || state.view === 'overview') openNewSkillModal();
      else if (state.view === 'mcp') openMcpModal(null);
      else rescan();
      return;
    }

    const edit = e.target.closest('[data-mcp-edit]');
    if (edit) {
      const target = state.serverIndex.find((s) => s.token === edit.dataset.mcpEdit);
      if (target) openMcpModal(target);
      return;
    }

    const del = e.target.closest('[data-mcp-del]');
    if (del) {
      openDeleteMcpModal(del.dataset.mcpDel);
      return;
    }

    const rootChip = e.target.closest('[data-skill-root]');
    if (rootChip) {
      state.skillRoot = rootChip.dataset.skillRoot;
      renderContent();
      return;
    }

    const clientChip = e.target.closest('[data-mcp-client]');
    if (clientChip) {
      state.mcpClient = clientChip.dataset.mcpClient;
      renderContent();
      return;
    }

    if (e.target.closest('[data-add-root]')) {
      openAddRootModal();
      return;
    }

    if (e.target.closest('[data-add-config]')) {
      openAddConfigModal();
      return;
    }

    if (e.target.closest('[data-rescan]')) {
      rescan();
      return;
    }

    if (e.target.closest('[data-open-data]')) {
      if (state.data) api.openPath(state.data.dataDir);
      return;
    }

    if (e.target.closest('[data-retry]')) {
      load();
      return;
    }

    const openPath = e.target.closest('[data-open-path]');
    if (openPath) {
      let target = openPath.dataset.openPath;
      try {
        const stat = target.endsWith('.json') || target.endsWith('.toml');
        if (stat) api.showItem(target);
        else api.openPath(target);
      } catch (_) {}
      return;
    }

    const reveal = e.target.closest('[data-reveal]');
    if (reveal) {
      api.showItem(reveal.dataset.reveal);
      return;
    }

    const copy = e.target.closest('[data-copy]');
    if (copy) {
      copyText(copy.dataset.copy);
      return;
    }

    const rootRemove = e.target.closest('[data-root-remove]');
    if (rootRemove) {
      const result = await call(api.removeRoot(rootRemove.dataset.rootRemove), '移除失败');
      applyState(result);
      render();
      showToast('已从列表移除');
      return;
    }

    const configRemove = e.target.closest('[data-config-remove]');
    if (configRemove) {
      const result = await call(api.removeConfig(configRemove.dataset.configRemove), '移除失败');
      applyState(result);
      render();
      showToast('已从列表移除');
      return;
    }

    const external = e.target.closest('[data-external]');
    if (external) {
      e.preventDefault();
      api.openExternal(external.dataset.external);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.getElementById('modal-root').querySelector('.modal-overlay')) {
        closeModal();
      } else if (document.getElementById('drawer').classList.contains('open')) {
        closeDrawer();
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.getElementById('search').focus();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      if (state.view === 'mcp') openMcpModal(null);
      else openNewSkillModal();
    }
  });

  document.getElementById('search').addEventListener('input', (e) => {
    state.query = e.target.value.trim();
    if (state.view === 'settings' && state.query) {
      state.view = 'overview';
      renderChrome();
    }
    renderContent();
    document.getElementById('content').scrollTop = 0;
  });
}

/* ---------------- boot ---------------- */

document.body.classList.toggle('is-mac', api.platform === 'darwin');
const shortcutHint = document.querySelector('.search kbd');
if (shortcutHint && api.platform !== 'darwin') shortcutHint.textContent = 'Ctrl K';
hydrateIcons();
bindEvents();
load();
