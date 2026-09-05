(function () {
  const root = document.getElementById("editor-root");
  const metaTitle = document.getElementById("meta-title");
  const metaNote = document.getElementById("meta-note");
  const saveHint = document.getElementById("save-hint");
  const statusBar = document.getElementById("status-bar");

  const ELEMENTS = ["", "动能", "烈日", "电弧", "虚空", "冰影", "缚丝"];
  const RATINGS = ["", ...RATING_TIERS];
  const TYPE_OPTIONS = ["", ...WEAPON_TYPES];
  const AMMO_OPTIONS = ["", ...AMMO_TYPES];
  const CHAMPS = ["势不可挡", "屏障", "过载"];

  let state = loadWeaponData().data;
  let saveTimer = null;
  let dirty = false;

  function showStatus(message, type) {
    statusBar.hidden = !message;
    statusBar.textContent = message || "";
    statusBar.className = "status-bar" + (type ? ` status-${type}` : "");
  }

  function markSaved() {
    dirty = false;
    const time = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    saveHint.textContent = `已自动保存 · ${time}`;
    saveHint.classList.remove("is-dirty");
  }

  function scheduleSave() {
    dirty = true;
    saveHint.textContent = "正在保存…";
    saveHint.classList.add("is-dirty");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveWeaponDraft(state);
      markSaved();
    }, 280);
  }

  function syncMetaToState() {
    state.seasonTitle = metaTitle.value.trim();
    state.seasonNote = metaNote.value.trim();
    scheduleSave();
  }

  function readWeaponFromRow(tr) {
    const get = (name) => tr.querySelector(`[data-field="${name}"]`)?.value ?? "";
    const checked = (name) =>
      Boolean(tr.querySelector(`[data-field="${name}"]`)?.checked);
    return {
      name: get("name").trim(),
      weaponType: get("weaponType").trim(),
      ammoType: get("ammoType").trim(),
      ratingPve: get("ratingPve").trim(),
      ratingPvp: get("ratingPvp").trim(),
      frame: get("frame").trim(),
      element: get("element").trim(),
      antiChamp: get("antiChamp").trim(),
      showPvePerk: checked("showPvePerk"),
      showPvpPerk: checked("showPvpPerk"),
      perk3Pve: get("perk3Pve").trim(),
      perk4Pve: get("perk4Pve").trim(),
      perk1Pvp: get("perk1Pvp").trim(),
      perk2Pvp: get("perk2Pvp").trim(),
      perk3Pvp: get("perk3Pvp").trim(),
      perk4Pvp: get("perk4Pvp").trim(),
      note: get("note").trim(),
    };
  }

  function syncSectionFromDom(sectionEl) {
    const sectionId = sectionEl.dataset.sectionId;
    const section = state.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const titleInput = sectionEl.querySelector(".section-title-input");
    if (titleInput) section.title = titleInput.value.trim() || "未命名途径";

    const rows = sectionEl.querySelectorAll("tbody tr[data-weapon-index]");
    section.weapons = Array.from(rows).map(readWeaponFromRow);
  }

  function syncAllFromDom() {
    state.seasonTitle = metaTitle.value.trim();
    state.seasonNote = metaNote.value.trim();
    root.querySelectorAll(".editor-section").forEach(syncSectionFromDom);
  }

  function optionList(values, selected) {
    return values
      .map((v) => {
        const label = v || "—";
        const sel = v === selected ? " selected" : "";
        return `<option value="${escapeAttr(v)}"${sel}>${escapeHtml(label)}</option>`;
      })
      .join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  function weaponRowHtml(weapon, index) {
    const w = weapon || emptyWeapon();
    const v = (key) => escapeAttr(w[key] || "");
    return `
      <tr data-weapon-index="${index}">
        <td class="col-actions">
          <button type="button" class="icon-btn" data-action="move-up" title="上移">↑</button>
          <button type="button" class="icon-btn" data-action="move-down" title="下移">↓</button>
          <button type="button" class="icon-btn danger" data-action="delete-weapon" title="删除">×</button>
        </td>
        <td><input data-field="name" type="text" value="${v("name")}" placeholder="武器名" /></td>
        <td class="cell-pve col-show">
          <input data-field="showPvePerk" type="checkbox" title="查看页展示 PVE Perk" ${w.showPvePerk !== false ? "checked" : ""} />
        </td>
        <td class="cell-pvp col-show">
          <input data-field="showPvpPerk" type="checkbox" title="查看页展示 PVP Perk" ${w.showPvpPerk !== false ? "checked" : ""} />
        </td>
        <td>
          <select data-field="weaponType">${optionList(TYPE_OPTIONS, w.weaponType)}</select>
        </td>
        <td>
          <select data-field="ammoType" class="ammo-select ${w.ammoType ? `ammo-${escapeAttr(w.ammoType)}` : ""}">${optionList(AMMO_OPTIONS, w.ammoType)}</select>
        </td>
        <td class="cell-pve"><input list="rating-list" data-field="ratingPve" type="text" value="${v("ratingPve")}" placeholder="PVE" /></td>
        <td class="cell-pvp"><input list="rating-list" data-field="ratingPvp" type="text" value="${v("ratingPvp")}" placeholder="PVP" /></td>
        <td><input data-field="frame" type="text" value="${v("frame")}" placeholder="精密帧 · 180" /></td>
        <td>
          <select data-field="element" class="el-select ${w.element ? `el-${escapeAttr(w.element)}` : ""}">${optionList(ELEMENTS, w.element)}</select>
        </td>
        <td>
          <select data-field="antiChamp">
            ${w.antiChamp && CHAMPS.includes(w.antiChamp) ? "" : `<option value="" selected disabled>请选择</option>`}
            ${optionList(CHAMPS, w.antiChamp)}
          </select>
        </td>
        <td class="cell-pve"><input data-field="perk3Pve" type="text" value="${v("perk3Pve")}" placeholder="PVE 3" /></td>
        <td class="cell-pve"><input data-field="perk4Pve" type="text" value="${v("perk4Pve")}" placeholder="PVE 4" /></td>
        <td class="cell-pvp"><input data-field="perk1Pvp" type="text" value="${v("perk1Pvp")}" placeholder="PVP 1" /></td>
        <td class="cell-pvp"><input data-field="perk2Pvp" type="text" value="${v("perk2Pvp")}" placeholder="PVP 2" /></td>
        <td class="cell-pvp"><input data-field="perk3Pvp" type="text" value="${v("perk3Pvp")}" placeholder="PVP 3" /></td>
        <td class="cell-pvp"><input data-field="perk4Pvp" type="text" value="${v("perk4Pvp")}" placeholder="PVP 4" /></td>
        <td><input data-field="note" type="text" value="${v("note")}" placeholder="备注" /></td>
      </tr>
    `;
  }

  function sectionHtml(section) {
    const weapons = section.weapons || [];
    const rows =
      weapons.length > 0
        ? weapons.map((w, i) => weaponRowHtml(w, i)).join("")
        : `<tr class="empty-editor-row"><td colspan="18">暂无武器，点击下方「添加武器」</td></tr>`;

    return `
      <section class="editor-section section" data-section-id="${escapeAttr(section.id)}">
        <div class="editor-section-head">
          <div class="editor-section-title-wrap">
            <input class="section-title-input" type="text" value="${escapeAttr(section.title)}" aria-label="获取途径名称" />
            <span class="section-count">${weapons.length} 把</span>
          </div>
          <div class="editor-section-tools">
            <button type="button" class="btn-ghost sm" data-action="move-section-up">上移分块</button>
            <button type="button" class="btn-ghost sm" data-action="move-section-down">下移分块</button>
            <button type="button" class="btn-ghost sm danger-text" data-action="delete-section">删除分块</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="editor-table">
            <thead>
              <tr>
                <th class="col-actions" rowspan="2">操作</th>
                <th rowspan="2">武器名</th>
                <th class="th-pve" rowspan="2" title="查看页是否展示该武器的 PVE Perk">展PVE</th>
                <th class="th-pvp" rowspan="2" title="查看页是否展示该武器的 PVP Perk">展PVP</th>
                <th rowspan="2">武器类型</th>
                <th rowspan="2">弹药类型</th>
                <th class="th-group th-pve" colspan="1">PVE</th>
                <th class="th-group th-pvp" colspan="1">PVP</th>
                <th rowspan="2">框架射速</th>
                <th rowspan="2">属性</th>
                <th rowspan="2">反勇士</th>
                <th class="th-group th-pve" colspan="2">PVE Perk</th>
                <th class="th-group th-pvp" colspan="4">PVP Perk</th>
                <th rowspan="2">备注</th>
              </tr>
              <tr>
                <th class="th-pve">评级</th>
                <th class="th-pvp">评级</th>
                <th class="th-pve">3</th>
                <th class="th-pve">4</th>
                <th class="th-pvp">1</th>
                <th class="th-pvp">2</th>
                <th class="th-pvp">3</th>
                <th class="th-pvp">4</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="editor-section-foot">
          <button type="button" class="btn-secondary sm" data-action="add-weapon">＋ 添加武器</button>
        </div>
      </section>
    `;
  }

  function render() {
    metaTitle.value = state.seasonTitle || "";
    metaNote.value = state.seasonNote || "";

    if (!state.sections.length) {
      root.innerHTML =
        '<p class="no-results">还没有获取途径分块。点击上方「添加获取途径」开始。</p>';
      return;
    }

    root.innerHTML = `
      <datalist id="rating-list">
        ${RATINGS.filter(Boolean)
          .map((c) => `<option value="${escapeAttr(c)}"></option>`)
          .join("")}
      </datalist>
      <div class="sections">${state.sections.map(sectionHtml).join("")}</div>
    `;
  }

  function findSectionIndex(sectionId) {
    return state.sections.findIndex((s) => s.id === sectionId);
  }

  root.addEventListener("input", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (
      target.matches("[data-field], .section-title-input") ||
      target.id === "meta-title" ||
      target.id === "meta-note"
    ) {
      if (target.matches('select[data-field="element"]')) {
        target.className = "el-select";
        const val = target.value;
        if (val) target.classList.add(`el-${val}`);
      }
      if (target.matches('select[data-field="ammoType"]')) {
        target.className = "ammo-select";
        const val = target.value;
        if (val) target.classList.add(`ammo-${val}`);
      }
      const sectionEl = target.closest(".editor-section");
      if (sectionEl) syncSectionFromDom(sectionEl);
      scheduleSave();
    }
  });

  root.addEventListener("change", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches("[data-field], .section-title-input")) {
      if (target.matches('select[data-field="element"]')) {
        target.className = "el-select";
        const val = target.value;
        if (val) target.classList.add(`el-${val}`);
      }
      if (target.matches('select[data-field="ammoType"]')) {
        target.className = "ammo-select";
        const val = target.value;
        if (val) target.classList.add(`ammo-${val}`);
      }
      const sectionEl = target.closest(".editor-section");
      if (sectionEl) syncSectionFromDom(sectionEl);
      scheduleSave();
    }
  });

  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const sectionEl = btn.closest(".editor-section");
    if (!sectionEl && action !== "add-section") return;

    syncAllFromDom();

    const sectionId = sectionEl?.dataset.sectionId;
    const sIndex = sectionId ? findSectionIndex(sectionId) : -1;
    const section = sIndex >= 0 ? state.sections[sIndex] : null;
    const row = btn.closest("tr[data-weapon-index]");
    const wIndex = row ? Number(row.dataset.weaponIndex) : -1;

    if (action === "add-weapon" && section) {
      section.weapons.push(emptyWeapon());
      saveWeaponDraft(state);
      render();
      markSaved();
      const focus = root.querySelector(
        `[data-section-id="${CSS.escape(section.id)}"] tbody tr:last-child [data-field="name"]`
      );
      focus?.focus();
      return;
    }

    if (action === "delete-weapon" && section && wIndex >= 0) {
      section.weapons.splice(wIndex, 1);
      saveWeaponDraft(state);
      render();
      markSaved();
      return;
    }

    if (action === "move-up" && section && wIndex > 0) {
      const arr = section.weapons;
      [arr[wIndex - 1], arr[wIndex]] = [arr[wIndex], arr[wIndex - 1]];
      saveWeaponDraft(state);
      render();
      markSaved();
      return;
    }

    if (action === "move-down" && section && wIndex >= 0 && wIndex < section.weapons.length - 1) {
      const arr = section.weapons;
      [arr[wIndex], arr[wIndex + 1]] = [arr[wIndex + 1], arr[wIndex]];
      saveWeaponDraft(state);
      render();
      markSaved();
      return;
    }

    if (action === "move-section-up" && sIndex > 0) {
      const arr = state.sections;
      [arr[sIndex - 1], arr[sIndex]] = [arr[sIndex], arr[sIndex - 1]];
      saveWeaponDraft(state);
      render();
      markSaved();
      return;
    }

    if (action === "move-section-down" && sIndex >= 0 && sIndex < state.sections.length - 1) {
      const arr = state.sections;
      [arr[sIndex], arr[sIndex + 1]] = [arr[sIndex + 1], arr[sIndex]];
      saveWeaponDraft(state);
      render();
      markSaved();
      return;
    }

    if (action === "delete-section" && sIndex >= 0) {
      const title = state.sections[sIndex].title;
      const count = state.sections[sIndex].weapons?.length || 0;
      const ok = confirm(
        count > 0
          ? `确定删除「${title}」及其 ${count} 把武器？`
          : `确定删除空分块「${title}」？`
      );
      if (!ok) return;
      state.sections.splice(sIndex, 1);
      saveWeaponDraft(state);
      render();
      markSaved();
    }
  });

  metaTitle.addEventListener("input", syncMetaToState);
  metaNote.addEventListener("input", syncMetaToState);

  document.getElementById("btn-add-section").addEventListener("click", () => {
    syncAllFromDom();
    const title = prompt("新获取途径名称：", "新获取途径");
    if (title === null) return;
    state.sections.push({
      id: makeSectionId(title),
      title: title.trim() || "新获取途径",
      weapons: [],
    });
    saveWeaponDraft(state);
    render();
    markSaved();
  });

  document.getElementById("btn-export").addEventListener("click", () => {
    syncAllFromDom();
    saveWeaponDraft(state);
    downloadDataJs(state);
    showStatus(
      "已下载 data.js。请用它覆盖项目文件夹中的同名文件。",
      "ok"
    );
    markSaved();
  });

  document.getElementById("btn-export-share").addEventListener("click", async () => {
    syncAllFromDom();
    saveWeaponDraft(state);
    try {
      await downloadShareHtml(state);
      showStatus(
        "已下载只读分享页。可直接发给他人双击打开；也可上传到 Netlify Drop / GitHub Pages 得到链接。更新项目内 share.html 可运行：node build-share.mjs",
        "ok"
      );
      markSaved();
    } catch (err) {
      console.error(err);
      showStatus(
        err?.message ||
          "导出失败。若用 file:// 打开导致无法读取资源，请改用本地服务器，或在本目录运行 node build-share.mjs",
        "error"
      );
    }
  });

  document.getElementById("btn-import").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const match = text.match(/const\s+WEAPON_DATA\s*=\s*(\{[\s\S]*\})\s*;?\s*$/m);
      if (!match) throw new Error("未找到 WEAPON_DATA");
      // eslint-disable-next-line no-new-func
      const parsed = new Function(`return (${match[1]})`)();
      if (!parsed || !Array.isArray(parsed.sections)) throw new Error("结构无效");
      state = normalizeWeaponData(parsed);
      saveWeaponDraft(state);
      render();
      markSaved();
      showStatus(`已导入：${file.name}`, "ok");
    } catch (err) {
      showStatus("导入失败：请确认选择的是本项目导出的 data.js。", "error");
      console.error(err);
    }
  });

  document.getElementById("btn-reload-file").addEventListener("click", () => {
    const ok = confirm(
      "将丢弃当前浏览器草稿，恢复为文件夹里 data.js 的内容。确定继续？"
    );
    if (!ok) return;
    clearWeaponDraft();
    state = normalizeWeaponData(WEAPON_DATA);
    render();
    markSaved();
    showStatus("已从 data.js 重新加载。", "ok");
  });

  window.addEventListener("beforeunload", () => {
    if (dirty) {
      syncAllFromDom();
      saveWeaponDraft(state);
    }
  });

  const loaded = loadWeaponData();
  state = loaded.data;
  if (loaded.fromDraft) {
    showStatus("已加载本机未导出的编辑草稿。导出 data.js 可写入文件夹。", "info");
  }
  render();
  markSaved();
})();
