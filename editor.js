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
  const PERK_SLOT_KEYS = ["perk1", "perk2", "perk3", "perk4"];

  const weaponsDbList =
    typeof WEAPONS_DB !== "undefined" && Array.isArray(WEAPONS_DB.weapons)
      ? WEAPONS_DB.weapons
      : [];
  const weaponsByName = new Map();
  for (const entry of weaponsDbList) {
    const key = String(entry.name || "").trim();
    if (!key) continue;
    if (!weaponsByName.has(key)) weaponsByName.set(key, []);
    weaponsByName.get(key).push(entry);
  }
  for (const list of weaponsByName.values()) {
    list.sort((a, b) => (a.seasonNumber || 0) - (b.seasonNumber || 0));
  }

  let state = loadWeaponData().data;
  let saveTimer = null;
  let dirty = false;
  let selectedSectionId = state.sections[0]?.id || null;
  let selectedWeaponIndex = 0;
  /** @type {object|null} 当前表单套用的清单版本 */
  let activeDbWeapon = null;

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

  function findDbByName(name) {
    return weaponsByName.get(String(name || "").trim()) || [];
  }

  function findDbEntry(hash) {
    if (hash == null || hash === "") return null;
    const n = Number(hash);
    return weaponsDbList.find((w) => w.hash === n) || null;
  }

  function seasonLabel(entry) {
    const n = entry.seasonNumber;
    const sn = entry.seasonName || "";
    if (n != null && sn) return `赛季 ${n} · ${sn}`;
    if (n != null) return `赛季 ${n}`;
    return sn || `hash ${entry.hash}`;
  }

  function parsePerkList(value) {
    return String(value || "")
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function joinPerkList(names) {
    const seen = new Set();
    const out = [];
    for (const raw of names) {
      const name = String(raw || "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
    return out.join("/");
  }

  function readPerkField(form, field) {
    const wrap = form.querySelector(`[data-perk-field="${field}"]`);
    if (!wrap) {
      return form.querySelector(`[data-field="${field}"]`)?.value ?? "";
    }
    const checked = [
      ...wrap.querySelectorAll("input[data-perk-option]:checked"),
    ].map((el) => el.getAttribute("data-perk-option") || "");
    return joinPerkList(checked);
  }

  function perkMultiHtml(field, selected, pool, disabled) {
    const selectedList = parsePerkList(selected);
    const selectedSet = new Set(selectedList);
    const list = Array.isArray(pool) ? [...pool] : [];
    const extras = selectedList.filter((name) => !list.includes(name));
    const names = [...extras, ...list];
    const options =
      names
        .map((name) => {
          const checked = selectedSet.has(name) ? " checked" : "";
          return `<label class="perk-multi-option"><input type="checkbox" data-perk-option="${escapeAttr(
            name
          )}"${checked}${disabled ? " disabled" : ""} /> <span>${escapeHtml(
            name
          )}</span></label>`;
        })
        .join("") ||
      `<p class="perk-multi-empty">暂无选项；匹配清单后显示，或在下方添加</p>`;

    return `
      <div class="perk-multi" data-perk-field="${escapeAttr(field)}" id="f-${escapeAttr(
      field
    )}">
        <div class="perk-multi-list">${options}</div>
        <div class="perk-multi-add-row">
          <input type="text" class="perk-multi-add" data-perk-add="${escapeAttr(
            field
          )}" placeholder="自定义添加，回车确认" ${disabled ? "disabled" : ""} />
        </div>
      </div>
    `;
  }

  function refreshPerkSelects(form, slots) {
    if (!form) return;
    const pools = slots || activeDbWeapon?.slots || {};
    const showPve = form.querySelector('[data-field="showPvePerk"]')?.checked;
    const showPvp = form.querySelector('[data-field="showPvpPerk"]')?.checked;

    for (const slot of PERK_SLOT_KEYS) {
      const pool = pools[slot] || [];
      for (const mode of ["Pve", "Pvp"]) {
        const field = `${slot}${mode}`;
        const wrap = form.querySelector(`[data-perk-field="${field}"]`);
        if (!wrap) continue;
        const prev = readPerkField(form, field);
        const enabled = mode === "Pve" ? showPve : showPvp;
        const parent = wrap.parentElement;
        if (!parent) continue;
        const label = parent.querySelector("label");
        const labelHtml = label ? label.outerHTML : "";
        parent.innerHTML =
          labelHtml + perkMultiHtml(field, prev, pool, !enabled);
      }
    }
  }

  function addCustomPerk(field, name) {
    const form = root.querySelector("#weapon-form");
    const wrap = form?.querySelector(`[data-perk-field="${field}"]`);
    if (!form || !wrap) return;
    const value = String(name || "").trim();
    if (!value) return;
    const list = wrap.querySelector(".perk-multi-list");
    if (!list) return;
    const existing = [
      ...list.querySelectorAll("input[data-perk-option]"),
    ].find((el) => el.getAttribute("data-perk-option") === value);
    if (existing) {
      existing.checked = true;
      return;
    }
    const empty = list.querySelector(".perk-multi-empty");
    if (empty) empty.remove();
    const label = document.createElement("label");
    label.className = "perk-multi-option";
    label.innerHTML = `<input type="checkbox" data-perk-option="${escapeAttr(
      value
    )}" checked /> <span>${escapeHtml(value)}</span>`;
    list.appendChild(label);
  }

  function resolveActiveDbForWeapon(weapon) {
    if (!weapon) return null;
    if (weapon.bungieHash != null) {
      const byHash = findDbEntry(weapon.bungieHash);
      if (byHash) return byHash;
    }
    const matches = findDbByName(weapon.name);
    if (matches.length === 1) return matches[0];
    if (weapon.seasonNumber != null) {
      const hit = matches.find(
        (m) => m.seasonNumber === Number(weapon.seasonNumber)
      );
      if (hit) return hit;
    }
    return null;
  }

  function applyDbVersion(entry, { silent } = {}) {
    const form = root.querySelector("#weapon-form");
    const weapon = currentWeapon();
    if (!form || !weapon || !entry) return;

    activeDbWeapon = entry;

    const setSelect = (field, value) => {
      const el = form.querySelector(`[data-field="${field}"]`);
      if (!el) return;
      const v = value == null ? "" : String(value);
      if (el.tagName === "SELECT") {
        let has = [...el.options].some((o) => o.value === v);
        if (!has) {
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = v || "—";
          if (v === "") {
            opt.disabled = false;
            el.insertBefore(opt, el.firstChild);
          } else {
            el.appendChild(opt);
          }
        } else if (v === "") {
          const empty = [...el.options].find((o) => o.value === "");
          if (empty) empty.disabled = false;
        }
        el.value = v;
      } else {
        el.value = v;
      }
      if (field === "element") {
        el.className = "el-select";
        if (el.value) el.classList.add(`el-${el.value}`);
      }
      if (field === "ammoType") {
        el.className = "ammo-select";
        if (el.value) el.classList.add(`ammo-${el.value}`);
      }
    };

    setSelect("weaponType", entry.weaponType || "");
    setSelect("ammoType", entry.ammoType || "");
    setSelect(
      "frame",
      String(entry.frame || "").trim().replace(/框架$/u, "")
    );
    setSelect("rpm", entry.rpm || "");
    setSelect("element", entry.element || "");
    setSelect("antiChamp", entry.antiChamp || "");

    const idx = state.weapons.findIndex((w) => w.id === weapon.id);
    if (idx >= 0) {
      state.weapons[idx].bungieHash = entry.hash;
      state.weapons[idx].seasonNumber =
        entry.seasonNumber == null ? null : entry.seasonNumber;
    }

    refreshPerkSelects(form, entry.slots || {});
    hideDbPicker();
    updateDbMatchHint(entry);
    readFormIntoWeapon();
    scheduleSave();

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

    if (!silent) {
      showStatus(`已套用清单：${seasonLabel(entry)}`, "ok");
    }
  }

  function hideDbPicker() {
    const picker = root.querySelector("#weapon-db-picker");
    if (picker) picker.hidden = true;
  }

  function showDbPicker(matches) {
    const picker = root.querySelector("#weapon-db-picker");
    if (!picker) return;
    picker.innerHTML = matches
      .map(
        (entry) => `
      <button type="button" class="weapon-db-pick" data-action="pick-db-version" data-hash="${escapeAttr(
        String(entry.hash)
      )}">
        ${escapeHtml(seasonLabel(entry))}
        <span class="weapon-db-pick-meta">${escapeHtml(
          [entry.frame, entry.element, entry.ammoType].filter(Boolean).join(" · ")
        )}</span>
      </button>`
      )
      .join("");
    picker.hidden = false;
  }

  function updateDbMatchHint(entry) {
    const hint = root.querySelector("#weapon-db-hint");
    if (!hint) return;
    if (!weaponsDbList.length) {
      hint.textContent = "未加载武器库（缺少 weapons-db.js）";
      return;
    }
    if (entry) {
      hint.textContent = `清单匹配：${seasonLabel(entry)}`;
      return;
    }
    hint.textContent = "输入精确中文名后自动匹配清单版本";
  }

  function tryMatchWeaponName({ preferHash } = {}) {
    const form = root.querySelector("#weapon-form");
    if (!form) return;
    const nameInput = form.querySelector('[data-field="name"]');
    const name = String(nameInput?.value || "").trim();
    hideDbPicker();

    if (!name) {
      activeDbWeapon = null;
      updateDbMatchHint(null);
      refreshPerkSelects(form, {});
      return;
    }

    const matches = findDbByName(name);
    if (!matches.length) {
      activeDbWeapon = null;
      updateDbMatchHint(null);
      refreshPerkSelects(form, {});
      return;
    }

    if (preferHash != null) {
      const preferred = matches.find((m) => m.hash === Number(preferHash));
      if (preferred) {
        if (activeDbWeapon?.hash === preferred.hash) {
          updateDbMatchHint(preferred);
          hideDbPicker();
          return;
        }
        applyDbVersion(preferred, { silent: true });
        return;
      }
    }

    if (matches.length === 1) {
      if (activeDbWeapon?.hash === matches[0].hash) {
        updateDbMatchHint(matches[0]);
        hideDbPicker();
        return;
      }
      applyDbVersion(matches[0]);
      return;
    }

    // 多版本：若已选 hash/赛季仍在列表中则保留，否则弹出选择
    const weapon = currentWeapon();
    const current =
      (weapon?.bungieHash != null &&
        matches.find((m) => m.hash === Number(weapon.bungieHash))) ||
      (activeDbWeapon &&
        matches.find((m) => m.hash === activeDbWeapon.hash)) ||
      null;

    if (current) {
      activeDbWeapon = current;
      updateDbMatchHint(current);
      refreshPerkSelects(form, current.slots || {});
      showDbPicker(matches);
      return;
    }

    updateDbMatchHint(null);
    showDbPicker(matches);
    showStatus(`「${name}」有 ${matches.length} 个赛季版本，请选择`, "info");
  }

  function currentSection() {
    return state.sections.find((s) => s.id === selectedSectionId) || null;
  }

  function currentSectionWeapons() {
    return resolveSectionWeapons(state, currentSection());
  }

  function currentWeapon() {
    const weapons = currentSectionWeapons();
    if (!weapons.length) return null;
    if (selectedWeaponIndex < 0 || selectedWeaponIndex >= weapons.length) {
      return null;
    }
    return weapons[selectedWeaponIndex];
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
    const len = currentSectionWeapons().length;
    if (len === 0) {
      selectedWeaponIndex = -1;
    } else if (selectedWeaponIndex < 0 || selectedWeaponIndex >= len) {
      selectedWeaponIndex = 0;
    }
  }

  function readFormIntoWeapon() {
    const form = root.querySelector("#weapon-form");
    const weapon = currentWeapon();
    if (!form || !weapon) return;

    const get = (name) => form.querySelector(`[data-field="${name}"]`)?.value ?? "";
    const getPerk = (name) => readPerkField(form, name);
    const checked = (name) =>
      Boolean(form.querySelector(`[data-field="${name}"]`)?.checked);

    const idx = state.weapons.findIndex((w) => w.id === weapon.id);
    if (idx < 0) return;

    state.weapons[idx] = {
      ...state.weapons[idx],
      id: weapon.id,
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
      perk1Pve: getPerk("perk1Pve"),
      perk2Pve: getPerk("perk2Pve"),
      perk3Pve: getPerk("perk3Pve"),
      perk4Pve: getPerk("perk4Pve"),
      perk1Pvp: getPerk("perk1Pvp"),
      perk2Pvp: getPerk("perk2Pvp"),
      perk3Pvp: getPerk("perk3Pvp"),
      perk4Pvp: getPerk("perk4Pvp"),
      bungieHash:
        activeDbWeapon?.hash ??
        state.weapons[idx].bungieHash ??
        null,
      seasonNumber:
        activeDbWeapon?.seasonNumber ??
        state.weapons[idx].seasonNumber ??
        null,
      note: get("note").trim(),
    };
  }

  function syncSectionLinksFromForm() {
    const form = root.querySelector("#weapon-form");
    const weapon = currentWeapon();
    if (!form || !weapon) return;
    const boxes = [
      ...form.querySelectorAll('input[data-section-link]'),
    ];
    if (!boxes.length) return;
    const selected = boxes
      .filter((el) => el.checked)
      .map((el) => el.getAttribute("data-section-link"));
    if (!selected.length) {
      // keep at least current section
      const fallback = selectedSectionId || state.sections[0]?.id;
      boxes.forEach((el) => {
        el.checked = el.getAttribute("data-section-link") === fallback;
      });
      selected.push(fallback);
    }
    setWeaponSectionMembership(state, weapon.id, selected);
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
    syncSectionLinksFromForm();
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
        const count = (section.weaponIds || []).length;
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
    const weapons = resolveSectionWeapons(state, section);
    if (!weapons.length) {
      return '<p class="editor-side-empty">暂无武器，点击上方「添加」或从已有武器加入</p>';
    }
    return weapons
      .map((w, i) => {
        const active = i === selectedWeaponIndex ? " is-active" : "";
        const name = w.name || "未命名武器";
        const paths = weaponSectionIds(state, w.id).length;
        const pathHint = paths > 1 ? ` · ${paths} 途径` : "";
        return `
          <div class="editor-side-item${active}" data-action="select-weapon" data-weapon-index="${i}">
            <div class="editor-side-item-main">
              <span class="editor-side-item-title">${escapeHtml(name)}</span>
              <span class="editor-side-item-meta">${escapeHtml(weaponSummary(w))}${escapeHtml(pathHint)}</span>
            </div>
            <div class="editor-side-item-tools">
              <button type="button" class="icon-btn" data-action="move-weapon-up" data-weapon-index="${i}" title="上移">↑</button>
              <button type="button" class="icon-btn" data-action="move-weapon-down" data-weapon-index="${i}" title="下移">↓</button>
              <button type="button" class="icon-btn danger" data-action="delete-weapon" data-weapon-index="${i}" title="从当前途径移除">×</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function linkExistingHtml(section) {
    const inSection = new Set(section?.weaponIds || []);
    const candidates = (state.weapons || []).filter((w) => w.id && !inSection.has(w.id));
    if (!candidates.length) {
      return "";
    }
    const options = candidates
      .map((w) => {
        const label = w.name || "未命名武器";
        return `<option value="${escapeAttr(w.id)}">${escapeHtml(label)}</option>`;
      })
      .join("");
    return `
      <div class="editor-link-existing">
        <select id="link-existing-weapon" aria-label="从已有武器加入">
          <option value="">从已有武器加入…</option>
          ${options}
        </select>
        <button type="button" class="btn-secondary sm" data-action="link-existing">加入</button>
      </div>
    `;
  }

  function sectionLinksHtml(weapon) {
    const owned = new Set(weaponSectionIds(state, weapon.id));
    return state.sections
      .map((section) => {
        const checked = owned.has(section.id) ? " checked" : "";
        return `<label><input type="checkbox" data-section-link="${escapeAttr(section.id)}"${checked} /> ${escapeHtml(section.title)}</label>`;
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
    activeDbWeapon = resolveActiveDbForWeapon(w);
    const slots = activeDbWeapon?.slots || {};
    const dbHint = activeDbWeapon
      ? `清单匹配：${seasonLabel(activeDbWeapon)}`
      : weaponsDbList.length
        ? "输入精确中文名后自动匹配清单版本"
        : "未加载武器库（缺少 weapons-db.js）";

    return `
      <form id="weapon-form" class="editor-form" autocomplete="off">
        <h2 class="editor-form-title">编辑武器</h2>

        <div class="editor-form-grid">
          <div class="field field-span-2 weapon-name-field">
            <label for="f-name">武器名</label>
            <input id="f-name" data-field="name" type="text" value="${v("name")}" placeholder="输入精确中文名以自动填充" />
            <p class="editor-hint" id="weapon-db-hint">${escapeHtml(dbHint)}</p>
            <div id="weapon-db-picker" class="weapon-db-picker" hidden></div>
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
          <h4>获取途径（可多选）</h4>
          <div class="editor-check-row editor-section-links">
            ${sectionLinksHtml(w)}
          </div>
          <p class="editor-hint">同一把枪可出现在多个途径；查看页会在对应途径下都显示。</p>
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
              <label for="f-perk1Pve">Perk 1（枪管/刀片）</label>
              ${perkMultiHtml("perk1Pve", w.perk1Pve, slots.perk1, !showPve)}
            </div>
            <div class="field">
              <label for="f-perk2Pve">Perk 2（弹匣/刀剑格）</label>
              ${perkMultiHtml("perk2Pve", w.perk2Pve, slots.perk2, !showPve)}
            </div>
            <div class="field">
              <label for="f-perk3Pve">Perk 3</label>
              ${perkMultiHtml("perk3Pve", w.perk3Pve, slots.perk3, !showPve)}
            </div>
            <div class="field">
              <label for="f-perk4Pve">Perk 4</label>
              ${perkMultiHtml("perk4Pve", w.perk4Pve, slots.perk4, !showPve)}
            </div>
          </div>
        </div>

        <div class="editor-form-section pvp-block ${showPvp ? "" : "is-collapsed"}" id="pvp-perk-block">
          <h4>PVP Perk</h4>
          <div class="editor-form-grid">
            <div class="field">
              <label for="f-perk1Pvp">Perk 1（枪管/刀片）</label>
              ${perkMultiHtml("perk1Pvp", w.perk1Pvp, slots.perk1, !showPvp)}
            </div>
            <div class="field">
              <label for="f-perk2Pvp">Perk 2（弹匣/刀剑格）</label>
              ${perkMultiHtml("perk2Pvp", w.perk2Pvp, slots.perk2, !showPvp)}
            </div>
            <div class="field">
              <label for="f-perk3Pvp">Perk 3</label>
              ${perkMultiHtml("perk3Pvp", w.perk3Pvp, slots.perk3, !showPvp)}
            </div>
            <div class="field">
              <label for="f-perk4Pvp">Perk 4</label>
              ${perkMultiHtml("perk4Pvp", w.perk4Pvp, slots.perk4, !showPvp)}
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

    const prevSectionScroll =
      root.querySelector("#section-list")?.scrollTop ?? 0;
    const prevWeaponScroll =
      root.querySelector("#weapon-list")?.scrollTop ?? 0;
    const keepWeaponScroll =
      root.dataset.keepWeaponScroll === "1";
    delete root.dataset.keepWeaponScroll;

    if (!state.sections.length) {
      root.innerHTML =
        '<p class="no-results">还没有获取途径。点击上方「添加获取途径」开始。</p>';
      return;
    }

    const section = currentSection();
    const weapon = currentWeapon();

    root.innerHTML = `
      <div class="editor-layout">
        <aside class="editor-pane editor-pane-sections">
          <div class="editor-side-head">
            <h3>获取途径</h3>
          </div>
          <div class="editor-side-list" id="section-list">${sectionListHtml()}</div>
        </aside>
        <aside class="editor-pane editor-pane-weapons">
          <div class="editor-side-head">
            <h3>武器列表</h3>
            <button type="button" class="btn-secondary sm" data-action="add-weapon">＋ 添加</button>
          </div>
          <input id="section-rename" class="editor-section-rename" type="text" value="${escapeAttr(section?.title || "")}" aria-label="获取途径名称" placeholder="获取途径名称" />
          <input id="section-note" class="editor-section-note" type="text" value="${escapeAttr(section?.note || "")}" aria-label="获取途径备注" placeholder="途径备注（显示在查看页标题旁）" />
          ${linkExistingHtml(section)}
          <div class="editor-side-list" id="weapon-list">${weaponListHtml(section)}</div>
        </aside>
        <section class="editor-main">${formHtml(weapon)}</section>
      </div>
    `;

    const sectionList = root.querySelector("#section-list");
    const weaponList = root.querySelector("#weapon-list");
    if (sectionList) sectionList.scrollTop = prevSectionScroll;
    if (weaponList) {
      weaponList.scrollTop = keepWeaponScroll ? prevWeaponScroll : 0;
    }
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
      pveBlock.querySelectorAll("input, select").forEach((el) => {
        el.disabled = !showPve;
      });
    }
    if (pvpBlock) {
      pvpBlock.classList.toggle("is-collapsed", !showPvp);
      pvpBlock.querySelectorAll("input, select").forEach((el) => {
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
    root.dataset.keepWeaponScroll = "1";
    render();
    markSaved();
  }

  root.addEventListener("focusout", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches('#weapon-form [data-field="name"]')) {
      const related = e.relatedTarget;
      if (
        related instanceof Element &&
        related.closest("#weapon-db-picker")
      ) {
        return;
      }
      tryMatchWeaponName();
    }
  });

  root.addEventListener("keydown", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (
      target.matches('#weapon-form [data-field="name"]') &&
      e.key === "Enter"
    ) {
      e.preventDefault();
      tryMatchWeaponName();
      target.blur();
      return;
    }
    if (target.matches("#weapon-form [data-perk-add]") && e.key === "Enter") {
      e.preventDefault();
      const field = target.getAttribute("data-perk-add");
      if (field) {
        addCustomPerk(field, target.value);
        if ("value" in target) target.value = "";
        readFormIntoWeapon();
        scheduleSave();
      }
    }
  });

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

    if (
      target.matches("#weapon-form [data-field]") ||
      target.matches("#weapon-form [data-perk-option]")
    ) {
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

    if (target.matches("input[data-section-link]")) {
      const weapon = currentWeapon();
      if (!weapon) return;
      const form = root.querySelector("#weapon-form");
      const boxes = [
        ...form.querySelectorAll("input[data-section-link]"),
      ];
      let selected = boxes
        .filter((el) => el.checked)
        .map((el) => el.getAttribute("data-section-link"));
      if (!selected.length) {
        target.checked = true;
        selected = [target.getAttribute("data-section-link")];
        showStatus("至少保留一个获取途径。", "info");
      }
      setWeaponSectionMembership(state, weapon.id, selected);
      // if removed from current section, jump to first remaining section that has it
      if (!selected.includes(selectedSectionId)) {
        selectedSectionId = selected[0];
        const list = resolveSectionWeapons(
          state,
          state.sections.find((s) => s.id === selectedSectionId)
        );
        selectedWeaponIndex = Math.max(
          0,
          list.findIndex((w) => w.id === weapon.id)
        );
      } else {
        const list = currentSectionWeapons();
        selectedWeaponIndex = Math.max(
          0,
          list.findIndex((w) => w.id === weapon.id)
        );
      }
      scheduleSave();
      root.dataset.keepWeaponScroll = "1";
      render();
      return;
    }

    if (
      !target.matches("#weapon-form [data-field]") &&
      !target.matches("#weapon-form [data-perk-option]")
    ) {
      return;
    }

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

    if (action === "pick-db-version") {
      const entry = findDbEntry(actionable.dataset.hash);
      if (entry) applyDbVersion(entry);
      return;
    }

    if (action === "select-section") {
      syncAllFromDom();
      selectedSectionId = actionable.dataset.sectionId;
      selectedWeaponIndex = 0;
      saveWeaponDraft(state);
      // switching section: keep pathway list scroll, reset weapon list
      render();
      markSaved();
      return;
    }

    if (action === "select-weapon") {
      syncAllFromDom();
      selectedWeaponIndex = Number(actionable.dataset.weaponIndex);
      saveWeaponDraft(state);
      root.dataset.keepWeaponScroll = "1";
      render();
      markSaved();
      root.querySelector("#f-name")?.focus();
      return;
    }

    syncAllFromDom();

    if (action === "add-weapon") {
      const section = currentSection();
      if (!section) return;
      const weapon = emptyWeapon();
      weapon.id = makeWeaponId(weapon.name || "weapon");
      state.weapons.push(weapon);
      if (!Array.isArray(section.weaponIds)) section.weaponIds = [];
      section.weaponIds.push(weapon.id);
      afterMutation(section.weaponIds.length - 1);
      root.querySelector("#f-name")?.focus();
      return;
    }

    if (action === "link-existing") {
      const section = currentSection();
      const select = root.querySelector("#link-existing-weapon");
      const weaponId = select?.value;
      if (!section || !weaponId) return;
      addWeaponIdToSection(state, weaponId, section.id);
      const idx = (section.weaponIds || []).indexOf(weaponId);
      afterMutation(idx < 0 ? section.weaponIds.length - 1 : idx);
      return;
    }

    if (action === "delete-weapon") {
      const section = currentSection();
      const idx = Number(actionable.dataset.weaponIndex);
      const weapons = resolveSectionWeapons(state, section);
      if (!section || Number.isNaN(idx) || !weapons[idx]) return;
      const weapon = weapons[idx];
      const name = weapon.name || "未命名武器";
      const otherCount = weaponSectionIds(state, weapon.id).length - 1;
      const msg =
        otherCount > 0
          ? `从当前途径移除「${name}」？它仍会保留在另外 ${otherCount} 个途径中。`
          : `从当前途径移除「${name}」？它不在其他途径，将从武器库删除。`;
      if (!confirm(msg)) return;
      removeWeaponFromSection(state, weapon.id, section.id);
      afterMutation(Math.min(idx, (section.weaponIds || []).length - 1));
      return;
    }

    if (action === "move-weapon-up") {
      const section = currentSection();
      const idx = Number(actionable.dataset.weaponIndex);
      if (!section || idx <= 0) return;
      const arr = section.weaponIds;
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      afterMutation(idx - 1);
      return;
    }

    if (action === "move-weapon-down") {
      const section = currentSection();
      const idx = Number(actionable.dataset.weaponIndex);
      if (!section || idx < 0 || idx >= (section.weaponIds || []).length - 1)
        return;
      const arr = section.weaponIds;
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
      const count = state.sections[sIndex].weaponIds?.length || 0;
      const ok = confirm(
        count > 0
          ? `确定删除「${title}」？其中 ${count} 把武器会从该途径移除（若仅属于此途径则从武器库删除）。`
          : `确定删除空分块「${title}」？`
      );
      if (!ok) return;
      const ids = [...(state.sections[sIndex].weaponIds || [])];
      state.sections.splice(sIndex, 1);
      for (const weaponId of ids) {
        if (!weaponSectionIds(state, weaponId).length) {
          state.weapons = state.weapons.filter((w) => w.id !== weaponId);
        }
      }
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
      weaponIds: [],
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
