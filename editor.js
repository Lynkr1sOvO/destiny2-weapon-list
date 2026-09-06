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
  let selectedSectionId = state.sections[0]?.id || null;
  let selectedWeaponIndex = 0;

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

  function optionList(values, selected) {
    return values
      .map((v) => {
        const label = v || "—";
        const sel = v === selected ? " selected" : "";
        return `<option value="${escapeAttr(v)}"${sel}>${escapeHtml(label)}</option>`;
      })
      .join("");
  }

  function currentSection() {
    return state.sections.find((s) => s.id === selectedSectionId) || null;
  }

  function currentWeapon() {
    const section = currentSection();
    if (!section || !section.weapons?.length) return null;
    if (selectedWeaponIndex < 0 || selectedWeaponIndex >= section.weapons.length) {
      return null;
    }
    return section.weapons[selectedWeaponIndex];
  }

  function ensureSelection() {
    if (!state.sections.length) {
      selectedSectionId = null;
      selectedWeaponIndex = -1;
      return;
    }
    if (!state.sections.some((s) => s.id === selectedSectionId)) {
      selectedSectionId = state.sections[0].id;
    }
    const section = currentSection();
    const len = section?.weapons?.length || 0;
    if (len === 0) {
      selectedWeaponIndex = -1;
    } else if (selectedWeaponIndex < 0 || selectedWeaponIndex >= len) {
      selectedWeaponIndex = 0;
    }
  }

  function readFormIntoWeapon() {
    const form = root.querySelector("#weapon-form");
    const section = currentSection();
    if (!form || !section || selectedWeaponIndex < 0) return;

    const get = (name) => form.querySelector(`[data-field="${name}"]`)?.value ?? "";
    const checked = (name) =>
      Boolean(form.querySelector(`[data-field="${name}"]`)?.checked);

    section.weapons[selectedWeaponIndex] = {
      name: get("name").trim(),
      weaponType: get("weaponType").trim(),
      ammoType: get("ammoType").trim(),
      ratingPve: get("ratingPve").trim(),
      ratingPvp: get("ratingPvp").trim(),
      frame: get("frame").trim(),
      rpm: get("rpm").trim(),
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

  function syncAllFromDom() {
    state.seasonTitle = metaTitle.value.trim();
    state.seasonNote = metaNote.value.trim();
    const rename = root.querySelector("#section-rename");
    const noteInput = root.querySelector("#section-note");
    const section = currentSection();
    if (rename && section) {
      section.title = rename.value.trim() || "未命名途径";
    }
    if (noteInput && section) {
      section.note = noteInput.value.trim();
    }
    readFormIntoWeapon();
  }

  function weaponSummary(w) {
    const bits = [
      w.weaponType || "未选类型",
      w.ammoType || "未选弹药",
      w.ratingPve ? `PVE ${w.ratingPve}` : null,
      w.ratingPvp ? `PVP ${w.ratingPvp}` : null,
    ].filter(Boolean);
    return bits.join(" · ");
  }

  function sectionListHtml() {
    return state.sections
      .map((section) => {
        const active = section.id === selectedSectionId ? " is-active" : "";
        const count = section.weapons?.length || 0;
        return `
          <div class="editor-side-item${active}" data-action="select-section" data-section-id="${escapeAttr(section.id)}">
            <div class="editor-side-item-main">
              <span class="editor-side-item-title">${escapeHtml(section.title)}</span>
              <span class="editor-side-item-meta">${count} 把武器</span>
            </div>
            <div class="editor-side-item-tools">
              <button type="button" class="icon-btn" data-action="move-section-up" data-section-id="${escapeAttr(section.id)}" title="上移">↑</button>
              <button type="button" class="icon-btn" data-action="move-section-down" data-section-id="${escapeAttr(section.id)}" title="下移">↓</button>
              <button type="button" class="icon-btn danger" data-action="delete-section" data-section-id="${escapeAttr(section.id)}" title="删除">×</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function weaponListHtml(section) {
    const weapons = section?.weapons || [];
    if (!weapons.length) {
      return '<p class="editor-side-empty">暂无武器，点击下方添加</p>';
    }
    return weapons
      .map((w, i) => {
        const active = i === selectedWeaponIndex ? " is-active" : "";
        const name = w.name || "未命名武器";
        return `
          <div class="editor-side-item${active}" data-action="select-weapon" data-weapon-index="${i}">
            <div class="editor-side-item-main">
              <span class="editor-side-item-title">${escapeHtml(name)}</span>
              <span class="editor-side-item-meta">${escapeHtml(weaponSummary(w))}</span>
            </div>
            <div class="editor-side-item-tools">
              <button type="button" class="icon-btn" data-action="move-weapon-up" data-weapon-index="${i}" title="上移">↑</button>
              <button type="button" class="icon-btn" data-action="move-weapon-down" data-weapon-index="${i}" title="下移">↓</button>
              <button type="button" class="icon-btn danger" data-action="delete-weapon" data-weapon-index="${i}" title="删除">×</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function formHtml(weapon) {
    if (!weapon) {
      return `
        <div class="editor-form-empty">
          请先在左侧选择获取途径，并添加或选择一把武器进行编辑。
        </div>
      `;
    }

    const w = weapon;
    const showPve = w.showPvePerk !== false;
    const showPvp = w.showPvpPerk !== false;
    const v = (key) => escapeAttr(w[key] || "");

    return `
      <form id="weapon-form" class="editor-form" autocomplete="off">
        <h2 class="editor-form-title">编辑武器</h2>

        <div class="editor-form-grid">
          <div class="field field-span-2">
            <label for="f-name">武器名</label>
            <input id="f-name" data-field="name" type="text" value="${v("name")}" placeholder="输入武器名称" />
          </div>
          <div class="field">
            <label for="f-type">武器类型</label>
            <select id="f-type" data-field="weaponType">${optionList(TYPE_OPTIONS, w.weaponType)}</select>
          </div>
          <div class="field">
            <label for="f-ammo">弹药类型</label>
            <select id="f-ammo" data-field="ammoType" class="ammo-select ${w.ammoType ? `ammo-${escapeAttr(w.ammoType)}` : ""}">${optionList(AMMO_OPTIONS, w.ammoType)}</select>
          </div>
          <div class="field">
            <label for="f-frame">框架</label>
            <input id="f-frame" data-field="frame" type="text" value="${v("frame")}" placeholder="精密帧 / 支援 / 适配…" />
          </div>
          <div class="field">
            <label for="f-rpm">射速</label>
            <input id="f-rpm" data-field="rpm" type="text" value="${v("rpm")}" placeholder="可选，如 600" />
          </div>
          <div class="field">
            <label for="f-element">属性</label>
            <select id="f-element" data-field="element" class="el-select ${w.element ? `el-${escapeAttr(w.element)}` : ""}">${optionList(ELEMENTS, w.element)}</select>
          </div>
          <div class="field">
            <label for="f-champ">反勇士</label>
            <select id="f-champ" data-field="antiChamp">
              ${w.antiChamp && CHAMPS.includes(w.antiChamp) ? "" : `<option value="" selected disabled>请选择</option>`}
              ${optionList(CHAMPS, w.antiChamp)}
            </select>
          </div>
          <div class="field">
            <label for="f-rating-pve">PVE 评级</label>
            <select id="f-rating-pve" data-field="ratingPve">${optionList(RATINGS, w.ratingPve)}</select>
          </div>
          <div class="field">
            <label for="f-rating-pvp">PVP 评级</label>
            <select id="f-rating-pvp" data-field="ratingPvp">${optionList(RATINGS, w.ratingPvp)}</select>
          </div>
          <div class="field field-span-2">
            <label for="f-note">备注</label>
            <textarea id="f-note" data-field="note" placeholder="可选备注">${escapeHtml(w.note || "")}</textarea>
          </div>
        </div>

        <div class="editor-form-section">
          <h4>查看页 Perk 展示</h4>
          <div class="editor-check-row">
            <label><input data-field="showPvePerk" type="checkbox" ${showPve ? "checked" : ""} /> 展 PVE Perk</label>
            <label><input data-field="showPvpPerk" type="checkbox" ${showPvp ? "checked" : ""} /> 展 PVP Perk</label>
          </div>
        </div>

        <div class="editor-form-section pve-block ${showPve ? "" : "is-collapsed"}" id="pve-perk-block">
          <h4>PVE Perk</h4>
          <div class="editor-form-grid">
            <div class="field">
              <label for="f-perk3-pve">Perk 3</label>
              <input id="f-perk3-pve" data-field="perk3Pve" type="text" value="${v("perk3Pve")}" ${showPve ? "" : "disabled"} />
            </div>
            <div class="field">
              <label for="f-perk4-pve">Perk 4</label>
              <input id="f-perk4-pve" data-field="perk4Pve" type="text" value="${v("perk4Pve")}" ${showPve ? "" : "disabled"} />
            </div>
          </div>
        </div>

        <div class="editor-form-section pvp-block ${showPvp ? "" : "is-collapsed"}" id="pvp-perk-block">
          <h4>PVP Perk</h4>
          <div class="editor-form-grid">
            <div class="field">
              <label for="f-perk1-pvp">Perk 1</label>
              <input id="f-perk1-pvp" data-field="perk1Pvp" type="text" value="${v("perk1Pvp")}" ${showPvp ? "" : "disabled"} />
            </div>
            <div class="field">
              <label for="f-perk2-pvp">Perk 2</label>
              <input id="f-perk2-pvp" data-field="perk2Pvp" type="text" value="${v("perk2Pvp")}" ${showPvp ? "" : "disabled"} />
            </div>
            <div class="field">
              <label for="f-perk3-pvp">Perk 3</label>
              <input id="f-perk3-pvp" data-field="perk3Pvp" type="text" value="${v("perk3Pvp")}" ${showPvp ? "" : "disabled"} />
            </div>
            <div class="field">
              <label for="f-perk4-pvp">Perk 4</label>
              <input id="f-perk4-pvp" data-field="perk4Pvp" type="text" value="${v("perk4Pvp")}" ${showPvp ? "" : "disabled"} />
            </div>
          </div>
        </div>
      </form>
    `;
  }

  function render() {
    metaTitle.value = state.seasonTitle || "";
    metaNote.value = state.seasonNote || "";
    ensureSelection();

    if (!state.sections.length) {
      root.innerHTML =
        '<p class="no-results">还没有获取途径。点击上方「添加获取途径」开始。</p>';
      return;
    }

    const section = currentSection();
    const weapon = currentWeapon();

    root.innerHTML = `
      <div class="editor-layout">
        <aside class="editor-sidebar">
          <div class="editor-side-block">
            <div class="editor-side-head">
              <h3>获取途径</h3>
            </div>
            <div class="editor-side-list">${sectionListHtml()}</div>
          </div>
          <div class="editor-side-block">
            <div class="editor-side-head">
              <h3>武器列表</h3>
              <button type="button" class="btn-secondary sm" data-action="add-weapon">＋ 添加</button>
            </div>
            <input id="section-rename" class="editor-section-rename" type="text" value="${escapeAttr(section?.title || "")}" aria-label="获取途径名称" placeholder="获取途径名称" />
            <input id="section-note" class="editor-section-note" type="text" value="${escapeAttr(section?.note || "")}" aria-label="获取途径备注" placeholder="途径备注（显示在查看页标题旁）" />
            <div class="editor-side-list" id="weapon-list">${weaponListHtml(section)}</div>
          </div>
        </aside>
        <section class="editor-main">${formHtml(weapon)}</section>
      </div>
    `;
  }

  function updatePerkVisibility() {
    const form = root.querySelector("#weapon-form");
    if (!form) return;
    const showPve = form.querySelector('[data-field="showPvePerk"]')?.checked;
    const showPvp = form.querySelector('[data-field="showPvpPerk"]')?.checked;
    const pveBlock = form.querySelector("#pve-perk-block");
    const pvpBlock = form.querySelector("#pvp-perk-block");
    if (pveBlock) {
      pveBlock.classList.toggle("is-collapsed", !showPve);
      pveBlock.querySelectorAll("input").forEach((el) => {
        el.disabled = !showPve;
      });
    }
    if (pvpBlock) {
      pvpBlock.classList.toggle("is-collapsed", !showPvp);
      pvpBlock.querySelectorAll("input").forEach((el) => {
        el.disabled = !showPvp;
      });
    }
  }

  function findSectionIndex(sectionId) {
    return state.sections.findIndex((s) => s.id === sectionId);
  }

  function afterMutation(preferWeaponIndex) {
    saveWeaponDraft(state);
    if (typeof preferWeaponIndex === "number") {
      selectedWeaponIndex = preferWeaponIndex;
    }
    render();
    markSaved();
  }

  root.addEventListener("input", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.id === "section-rename") {
      const section = currentSection();
      if (section) {
        section.title = target.value.trim() || "未命名途径";
        scheduleSave();
        // soft-update section list titles without losing form focus
        const active = root.querySelector(
          `.editor-side-item.is-active[data-action="select-section"] .editor-side-item-title`
        );
        if (active) active.textContent = section.title;
      }
      return;
    }

    if (target.id === "section-note") {
      const section = currentSection();
      if (section) {
        section.note = target.value.trim();
        scheduleSave();
      }
      return;
    }

    if (target.matches("#weapon-form [data-field]")) {
      if (target.matches('select[data-field="element"]')) {
        target.className = "el-select";
        if (target.value) target.classList.add(`el-${target.value}`);
      }
      if (target.matches('select[data-field="ammoType"]')) {
        target.className = "ammo-select";
        if (target.value) target.classList.add(`ammo-${target.value}`);
      }
      readFormIntoWeapon();
      scheduleSave();

      // live-update selected weapon summary in sidebar
      const item = root.querySelector(
        `.editor-side-item.is-active[data-action="select-weapon"]`
      );
      const w = currentWeapon();
      if (item && w) {
        const title = item.querySelector(".editor-side-item-title");
        const meta = item.querySelector(".editor-side-item-meta");
        if (title) title.textContent = w.name || "未命名武器";
        if (meta) meta.textContent = weaponSummary(w);
      }
    }
  });

  root.addEventListener("change", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches("#weapon-form [data-field]")) return;

    if (
      target.matches('[data-field="showPvePerk"], [data-field="showPvpPerk"]')
    ) {
      updatePerkVisibility();
    }
    if (target.matches('select[data-field="element"]')) {
      target.className = "el-select";
      if (target.value) target.classList.add(`el-${target.value}`);
    }
    if (target.matches('select[data-field="ammoType"]')) {
      target.className = "ammo-select";
      if (target.value) target.classList.add(`ammo-${target.value}`);
    }
    readFormIntoWeapon();
    scheduleSave();
  });

  root.addEventListener("click", (e) => {
    const actionable = e.target.closest("[data-action]");
    if (!actionable) return;

    const action = actionable.dataset.action;

    if (action === "select-section") {
      syncAllFromDom();
      selectedSectionId = actionable.dataset.sectionId;
      selectedWeaponIndex = 0;
      saveWeaponDraft(state);
      render();
      markSaved();
      return;
    }

    if (action === "select-weapon") {
      syncAllFromDom();
      selectedWeaponIndex = Number(actionable.dataset.weaponIndex);
      saveWeaponDraft(state);
      render();
      markSaved();
      root.querySelector("#f-name")?.focus();
      return;
    }

    syncAllFromDom();

    if (action === "add-weapon") {
      const section = currentSection();
      if (!section) return;
      section.weapons.push(emptyWeapon());
      afterMutation(section.weapons.length - 1);
      root.querySelector("#f-name")?.focus();
      return;
    }

    if (action === "delete-weapon") {
      const section = currentSection();
      const idx = Number(actionable.dataset.weaponIndex);
      if (!section || Number.isNaN(idx)) return;
      const name = section.weapons[idx]?.name || "未命名武器";
      if (!confirm(`确定删除武器「${name}」？`)) return;
      section.weapons.splice(idx, 1);
      afterMutation(Math.min(idx, section.weapons.length - 1));
      return;
    }

    if (action === "move-weapon-up") {
      const section = currentSection();
      const idx = Number(actionable.dataset.weaponIndex);
      if (!section || idx <= 0) return;
      const arr = section.weapons;
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      afterMutation(idx - 1);
      return;
    }

    if (action === "move-weapon-down") {
      const section = currentSection();
      const idx = Number(actionable.dataset.weaponIndex);
      if (!section || idx < 0 || idx >= section.weapons.length - 1) return;
      const arr = section.weapons;
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      afterMutation(idx + 1);
      return;
    }

    if (action === "move-section-up" || action === "move-section-down") {
      const id = actionable.dataset.sectionId;
      const sIndex = findSectionIndex(id);
      if (sIndex < 0) return;
      const arr = state.sections;
      if (action === "move-section-up" && sIndex > 0) {
        [arr[sIndex - 1], arr[sIndex]] = [arr[sIndex], arr[sIndex - 1]];
      } else if (
        action === "move-section-down" &&
        sIndex < arr.length - 1
      ) {
        [arr[sIndex], arr[sIndex + 1]] = [arr[sIndex + 1], arr[sIndex]];
      }
      selectedSectionId = id;
      afterMutation(selectedWeaponIndex);
      return;
    }

    if (action === "delete-section") {
      const id = actionable.dataset.sectionId;
      const sIndex = findSectionIndex(id);
      if (sIndex < 0) return;
      const title = state.sections[sIndex].title;
      const count = state.sections[sIndex].weapons?.length || 0;
      const ok = confirm(
        count > 0
          ? `确定删除「${title}」及其 ${count} 把武器？`
          : `确定删除空分块「${title}」？`
      );
      if (!ok) return;
      state.sections.splice(sIndex, 1);
      selectedSectionId = state.sections[0]?.id || null;
      selectedWeaponIndex = 0;
      afterMutation(0);
    }
  });

  metaTitle.addEventListener("input", syncMetaToState);
  metaNote.addEventListener("input", syncMetaToState);

  document.getElementById("btn-add-section").addEventListener("click", () => {
    syncAllFromDom();
    const title = prompt("新获取途径名称：", "新获取途径");
    if (title === null) return;
    const section = {
      id: makeSectionId(title),
      title: title.trim() || "新获取途径",
      note: "",
      weapons: [],
    };
    state.sections.push(section);
    selectedSectionId = section.id;
    selectedWeaponIndex = -1;
    afterMutation(-1);
  });

  document.getElementById("btn-export").addEventListener("click", () => {
    syncAllFromDom();
    saveWeaponDraft(state);
    downloadDataJs(state);
    showStatus("已下载 data.js。请用它覆盖项目文件夹中的同名文件。", "ok");
    markSaved();
  });

  document.getElementById("btn-export-share").addEventListener("click", async () => {
    syncAllFromDom();
    saveWeaponDraft(state);
    try {
      await downloadShareHtml(state);
      showStatus(
        "已下载只读分享页。可直接发给他人双击打开；也可上传到 Netlify Drop / GitHub Pages 得到链接。",
        "ok"
      );
      markSaved();
    } catch (err) {
      console.error(err);
      showStatus(
        err?.message ||
          "导出失败。若用 file:// 打开导致无法读取资源，请改用本地服务器，或运行 node build-share.mjs",
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
      selectedSectionId = state.sections[0]?.id || null;
      selectedWeaponIndex = 0;
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
    selectedSectionId = state.sections[0]?.id || null;
    selectedWeaponIndex = 0;
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
  selectedSectionId = state.sections[0]?.id || null;
  selectedWeaponIndex = 0;
  if (loaded.fromDraft) {
    showStatus("已加载本机未导出的编辑草稿。导出 data.js 可写入文件夹。", "info");
  }
  render();
  markSaved();
})();
