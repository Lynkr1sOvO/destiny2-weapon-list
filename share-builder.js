/**
 * 组装只读单文件分享页（无编辑器、忽略 localStorage 草稿）
 * @param {object} data WEAPON_DATA 快照
 * @param {{ css: string, storageJs: string, appJs: string, dbViewJs?: string, weaponsDbJs?: string }} assets
 */
function buildShareHtml(data, assets) {
  // Do not retouch updatedAt here — every rebuild would dirty share.html/docs
  // and create an extra commit when publish push fails and is retried.
  const enriched = enrichWeaponsWithBungieHash(data);
  const normalized = normalizeWeaponData(enriched);
  const payload = JSON.stringify(normalized, null, 2);
  const pageTitle = escapeHtmlText(
    normalized.seasonTitle || "Destiny 2 武器清单"
  );
  const css = String(assets.css || "");
  const storageJs = sanitizeInlineScript(assets.storageJs || "");
  const appJs = sanitizeInlineScript(assets.appJs || "");
  const dbViewJs = sanitizeInlineScript(assets.dbViewJs || "");
  let weaponsDbJs = sanitizeInlineScript(assets.weaponsDbJs || "");
  if (!weaponsDbJs && typeof WEAPONS_DB !== "undefined") {
    weaponsDbJs = sanitizeInlineScript(
      `const WEAPONS_DB = ${JSON.stringify(WEAPONS_DB)};`
    );
  }
  const dataJs = sanitizeInlineScript(
    `const D2_SHARE_READONLY = true;\nconst WEAPON_DATA = ${payload};`
  );

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${pageTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&family=Orbitron:wght@600;700&display=swap" rel="stylesheet" />
  <style>
${css}
  </style>
</head>
<body>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="page page-viewer">
    <header class="hero">
      <div class="hero-top">
        <div>
          <p class="hero-kicker">Destiny 2</p>
          <h1 id="season-title">本赛季可获取武器清单</h1>
          <p class="hero-note" id="season-note"></p>
        </div>
        <div class="hero-actions">
          <p class="last-updated" id="last-updated" hidden></p>
        </div>
      </div>

      <div class="view-mode-switch" role="tablist" aria-label="查看模式">
        <button type="button" class="view-mode-btn is-active" data-view="list" role="tab" aria-selected="true" id="view-btn-list">赛季清单</button>
        <button type="button" class="view-mode-btn" data-view="db" role="tab" aria-selected="false" id="view-btn-db">完整武器库</button>
      </div>

      <div class="stats">
        <div class="stat">
          <span class="stat-value" id="count-total">0</span>
          <span class="stat-label" id="count-total-label">武器总数</span>
        </div>
        <div class="stat">
          <span class="stat-value" id="count-visible">0</span>
          <span class="stat-label" id="count-visible-label">当前可见</span>
        </div>
        <div class="stat">
          <span class="stat-value" id="count-sections">0</span>
          <span class="stat-label" id="count-sections-label">获取途径</span>
        </div>
      </div>
    </header>

    <div id="view-list" class="view-panel">
      <div class="toolbar">
        <div class="field">
          <label for="search">搜索</label>
          <input id="search" type="search" placeholder="武器名、Perk、备注…" autocomplete="off" />
        </div>
        <div class="field">
          <label for="filter-type">武器类型</label>
          <select id="filter-type"><option value="">全部</option></select>
        </div>
        <div class="field">
          <label for="filter-ammo">弹药类型</label>
          <select id="filter-ammo">
            <option value="">全部</option>
            <option value="主要">主要</option>
            <option value="特殊">特殊</option>
            <option value="威能">威能</option>
          </select>
        </div>
        <div class="field">
          <label for="filter-section">获取途径</label>
          <select id="filter-section"><option value="">全部</option></select>
        </div>
        <div class="field">
          <label for="filter-element">属性</label>
          <select id="filter-element">
            <option value="">全部</option>
            <option value="动能">动能</option>
            <option value="烈日">烈日</option>
            <option value="电弧">电弧</option>
            <option value="虚空">虚空</option>
            <option value="冰影">冰影</option>
            <option value="缚丝">缚丝</option>
          </select>
        </div>
        <div class="field">
          <label for="filter-champ">反勇士</label>
          <select id="filter-champ">
            <option value="">全部</option>
            <option value="势不可挡">势不可挡</option>
            <option value="屏障">屏障</option>
            <option value="过载">过载</option>
          </select>
        </div>
        <div class="field">
          <label>Perk 展示</label>
          <div class="toggle-group">
            <label class="toggle-chip"><input type="checkbox" id="view-show-pve" checked /> PVE</label>
            <label class="toggle-chip"><input type="checkbox" id="view-show-pvp" checked /> PVP</label>
          </div>
        </div>
        <div class="field">
          <label>&nbsp;</label>
          <button type="button" class="btn-reset" id="reset-filters">重置</button>
        </div>
      </div>

      <main id="app"></main>
    </div>

    <div id="view-db" class="view-panel" hidden>
      <div class="db-search-block">
        <div class="db-search-label-row">
          <label for="db-search">武器库搜索</label>
          <button type="button" class="db-filter-help-open-btn" id="db-filter-help-open">过滤器指南</button>
        </div>
        <input id="db-search" type="search" placeholder="例如：is:solar is:grenadelauncher perkname:嫉妒刺客+诱导推销" autocomplete="off" spellcheck="false" />
      </div>

      <p id="db-hint" class="db-hint">输入条件后显示结果。点击「过滤器指南」查看全部命令。</p>
      <div id="db-results"></div>
    </div>
  </div>

  <div id="db-filter-help-modal" class="db-filter-help-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="db-filter-help-title">
    <div class="db-filter-help-panel">
      <header class="db-filter-help-header">
        <h2 id="db-filter-help-title">过滤器</h2>
        <button type="button" class="db-filter-help-close" id="db-filter-help-close" aria-label="关闭">×</button>
      </header>
      <p class="db-filter-help-intro">
        可用空格（AND）、<code>or</code>、<code>not</code> / <code>-</code> 与括号组合条件。例：
        <code>(is:handcannon is:solar) or (is:pulse is:arc)</code>；
        <code>perkname:嫉妒刺客+诱导推销</code> 要求分列，
        <code>perkname:A perkname:B</code> 不要求分列。点击命令可插入搜索框。
      </p>
      <div class="db-filter-help-search-wrap">
        <input id="db-filter-help-search" type="search" placeholder="搜索可用的过滤器命令" autocomplete="off" />
      </div>
      <div class="db-filter-help-table-wrap">
        <table class="db-filter-help-table">
          <thead>
            <tr><th>过滤器</th><th>描述</th></tr>
          </thead>
          <tbody id="db-filter-help-body"></tbody>
        </table>
      </div>
    </div>
  </div>

  <div id="table-hscroll" class="table-hscroll" hidden aria-hidden="true">
    <div class="table-hscroll-spacer"></div>
  </div>

  <script>${dataJs}</script>
  <script>${weaponsDbJs}</script>
  <script>${storageJs}</script>
  <script>${dbViewJs}</script>
  <script>${appJs}</script>
</body>
</html>
`;
}

function sanitizeInlineScript(code) {
  return String(code).replace(/<\/script/gi, "<\\/script");
}

function escapeHtmlText(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchShareAssets() {
  const [cssRes, storageRes, appRes, dbViewRes, weaponsDbRes] = await Promise.all([
    fetch("styles.css"),
    fetch("storage.js"),
    fetch("app.js"),
    fetch("db-view.js"),
    fetch("weapons-db.js"),
  ]);
  if (!cssRes.ok || !storageRes.ok || !appRes.ok || !dbViewRes.ok) {
    throw new Error(
      "无法读取 styles.css / storage.js / app.js / db-view.js（请通过本地文件夹或本地服务器打开编辑器后再导出）"
    );
  }
  if (!weaponsDbRes.ok) {
    throw new Error("无法读取 weapons-db.js，分享页需要完整武器库才能使用搜索");
  }
  const [css, storageJs, appJs, dbViewJs, weaponsDbJs] = await Promise.all([
    cssRes.text(),
    storageRes.text(),
    appRes.text(),
    dbViewRes.text(),
    weaponsDbRes.text(),
  ]);
  return { css, storageJs, appJs, dbViewJs, weaponsDbJs };
}

async function downloadShareHtml(data, filename) {
  const assets = await fetchShareAssets();
  const html = buildShareHtml(data, assets);
  const name =
    filename ||
    `${(data.seasonTitle || "命运2-武器清单").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40)}-分享.html`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return html;
}
