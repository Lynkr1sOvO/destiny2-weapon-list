(function () {
  const root = document.getElementById("app");
  const searchInput = document.getElementById("search");
  const typeFilter = document.getElementById("filter-type");
  const ammoFilter = document.getElementById("filter-ammo");
  const ratingFilter = document.getElementById("filter-rating");
  const elementFilter = document.getElementById("filter-element");
  const champFilter = document.getElementById("filter-champ");
  const viewShowPve = document.getElementById("view-show-pve");
  const viewShowPvp = document.getElementById("view-show-pvp");
  const resetBtn = document.getElementById("reset-filters");
  const countTotal = document.getElementById("count-total");
  const countVisible = document.getElementById("count-visible");
  const countSections = document.getElementById("count-sections");
  const seasonTitle = document.getElementById("season-title");
  const seasonNote = document.getElementById("season-note");
  const draftBanner = document.getElementById("draft-banner");

  const loaded = loadWeaponData();
  const DATA = loaded.data;

  if (!DATA || !Array.isArray(DATA.sections)) {
    root.innerHTML =
      '<p class="no-results">未找到数据。请确认 <code>data.js</code> 已正确加载。</p>';
    return;
  }

  if (draftBanner) {
    draftBanner.hidden = !loaded.fromDraft;
  }

  seasonTitle.textContent = DATA.seasonTitle || "Destiny 2 武器清单";
  seasonNote.textContent = DATA.seasonNote || "";

  const totalWeapons = DATA.sections.reduce(
    (sum, s) => sum + (s.weapons?.length || 0),
    0
  );
  countTotal.textContent = String(totalWeapons);
  countSections.textContent = String(DATA.sections.length);

  // 填充武器类型选项
  WEAPON_TYPES.forEach((type) => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = type;
    typeFilter.appendChild(opt);
  });

  function ratingClass(rating) {
    return ratingTierClass(rating);
  }

  function elementClass(element) {
    const known = ["动能", "烈日", "电弧", "虚空", "冰影", "缚丝"];
    return known.includes(element) ? `el-${element}` : "";
  }

  function ammoClass(ammo) {
    const known = ["主要", "特殊", "威能"];
    return known.includes(ammo) ? `ammo-${ammo}` : "";
  }

  function matchesFilters(weapon, filters) {
    const q = filters.q;
    if (q) {
      const hay = [
        weapon.name,
        weapon.weaponType,
        weapon.ammoType,
        weapon.frame,
        weapon.element,
        weapon.antiChamp,
        weapon.ratingPve,
        weapon.ratingPvp,
        weapon.perk3Pve,
        weapon.perk4Pve,
        weapon.perk1Pvp,
        weapon.perk2Pvp,
        weapon.perk3Pvp,
        weapon.perk4Pvp,
        weapon.note,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (filters.weaponType && weapon.weaponType !== filters.weaponType) {
      return false;
    }

    if (filters.ammoType && weapon.ammoType !== filters.ammoType) {
      return false;
    }

    if (filters.rating) {
      const want = String(filters.rating).trim().toUpperCase();
      const pve = String(weapon.ratingPve || "").trim().toUpperCase();
      const pvp = String(weapon.ratingPvp || "").trim().toUpperCase();
      if (pve !== want && pvp !== want) return false;
    }

    if (filters.element && weapon.element !== filters.element) return false;

    if (filters.champ) {
      if (String(weapon.antiChamp || "") !== filters.champ) return false;
    }

    return true;
  }

  function tint(text, className) {
    const label = text || "—";
    return `<span class="tint ${className}">${escapeHtml(label)}</span>`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function td(content, extraClass, rowspan, title) {
    const rs = rowspan > 1 ? ` rowspan="${rowspan}"` : "";
    const cls = extraClass ? ` class="${extraClass}"` : "";
    const tip = title ? ` title="${escapeHtml(title)}"` : "";
    return `<td${cls}${rs}${tip}>${content}</td>`;
  }

  function plainCell(value, extraClass, rowspan) {
    const text = value || "—";
    return td(escapeHtml(text), extraClass, rowspan, text);
  }

  function tintCell(value, className, extraClass, rowspan) {
    const text = value || "—";
    return td(tint(text, className), extraClass, rowspan, text);
  }

  function baseCells(weapon, rowspan) {
    return [
      plainCell(weapon.name, "name-cell", rowspan),
      plainCell(weapon.weaponType, "type-cell", rowspan),
      tintCell(weapon.ammoType, ammoClass(weapon.ammoType), "", rowspan),
      tintCell(weapon.ratingPve, ratingClass(weapon.ratingPve), "cell-pve", rowspan),
      tintCell(weapon.ratingPvp, ratingClass(weapon.ratingPvp), "cell-pvp", rowspan),
      plainCell(weapon.frame, "frame-cell", rowspan),
      tintCell(weapon.element, elementClass(weapon.element), "", rowspan),
      plainCell(weapon.antiChamp, "champ", rowspan),
    ].join("");
  }

  function noteCell(weapon, rowspan) {
    const text = weapon.note || "";
    return td(escapeHtml(text), "note-cell", rowspan, text);
  }

  function cell(value, extraClass) {
    return plainCell(value, extraClass, 1);
  }

  function emptyPerkCells() {
    return `
      <td class="mode-tag-cell">—</td>
      ${cell("—", "perk-cell")}
      ${cell("—", "perk-cell")}
      ${cell("—", "perk-cell")}
      ${cell("—", "perk-cell")}
    `;
  }

  function bothPerkCellsPve(weapon) {
    return `
      <td class="mode-tag-cell cell-pve">PVE</td>
      ${cell("—", "perk-cell cell-pve")}
      ${cell("—", "perk-cell cell-pve")}
      ${cell(weapon.perk3Pve, "perk-cell cell-pve")}
      ${cell(weapon.perk4Pve, "perk-cell cell-pve")}
    `;
  }

  function bothPerkCellsPvp(weapon) {
    return `
      <td class="mode-tag-cell cell-pvp">PVP</td>
      ${cell(weapon.perk1Pvp, "perk-cell cell-pvp")}
      ${cell(weapon.perk2Pvp, "perk-cell cell-pvp")}
      ${cell(weapon.perk3Pvp, "perk-cell cell-pvp")}
      ${cell(weapon.perk4Pvp, "perk-cell cell-pvp")}
    `;
  }

  function weaponFlags(weapon) {
    return {
      showPve: weapon.showPvePerk !== false,
      showPvp: weapon.showPvpPerk !== false,
    };
  }

  /** 结合查看页开关与武器自身展 PVE/PVP 配置 */
  function resolveDisplay(weapon, viewPve, viewPvp) {
    const { showPve, showPvp } = weaponFlags(weapon);

    if (viewPve && viewPvp) {
      return { visible: true, showPve, showPvp };
    }

    if (viewPve && !viewPvp) {
      if (!showPve) return { visible: false, showPve: false, showPvp: false };
      return { visible: true, showPve: true, showPvp: false };
    }

    if (viewPvp && !viewPve) {
      if (!showPvp) return { visible: false, showPve: false, showPvp: false };
      return { visible: true, showPve: false, showPvp: true };
    }

    return { visible: false, showPve: false, showPvp: false };
  }

  function weaponRows(weapon, showPve, showPvp, pairClass) {
    if (showPve && showPvp) {
      return `
        <tr class="weapon-row ${pairClass}">
          ${baseCells(weapon, 2)}
          ${bothPerkCellsPve(weapon)}
          ${noteCell(weapon, 2)}
        </tr>
        <tr class="weapon-row weapon-row-cont ${pairClass}">
          ${bothPerkCellsPvp(weapon)}
        </tr>
      `;
    }

    if (showPve) {
      return `
        <tr class="weapon-row ${pairClass}">
          ${baseCells(weapon, 1)}
          ${bothPerkCellsPve(weapon)}
          ${noteCell(weapon, 1)}
        </tr>
      `;
    }

    if (showPvp) {
      return `
        <tr class="weapon-row ${pairClass}">
          ${baseCells(weapon, 1)}
          ${bothPerkCellsPvp(weapon)}
          ${noteCell(weapon, 1)}
        </tr>
      `;
    }

    return `
      <tr class="weapon-row ${pairClass}">
        ${baseCells(weapon, 1)}
        ${emptyPerkCells()}
        ${noteCell(weapon, 1)}
      </tr>
    `;
  }

  function colGroup() {
    return `<colgroup>
      <col class="col-name" />
      <col class="col-type" />
      <col class="col-ammo" />
      <col class="col-rating" />
      <col class="col-rating" />
      <col class="col-frame" />
      <col class="col-element" />
      <col class="col-champ" />
      <col class="col-mode" />
      <col class="col-perk" />
      <col class="col-perk" />
      <col class="col-perk" />
      <col class="col-perk" />
      <col class="col-note" />
    </colgroup>`;
  }

  function tableHead() {
    return `
      <thead>
        <tr>
          <th rowspan="2">武器名</th>
          <th rowspan="2">武器类型</th>
          <th rowspan="2">弹药类型</th>
          <th class="th-pve" rowspan="2">PVE评级</th>
          <th class="th-pvp" rowspan="2">PVP评级</th>
          <th rowspan="2">框架射速</th>
          <th rowspan="2">属性</th>
          <th rowspan="2">反勇士</th>
          <th class="th-group" colspan="5">Perk 组合</th>
          <th rowspan="2">备注</th>
        </tr>
        <tr>
          <th>用途</th>
          <th>1</th>
          <th>2</th>
          <th>3</th>
          <th>4</th>
        </tr>
      </thead>
    `;
  }

  function render() {
    const viewPve = viewShowPve.checked;
    const viewPvp = viewShowPvp.checked;

    const filters = {
      q: searchInput.value.trim().toLowerCase(),
      weaponType: typeFilter.value,
      ammoType: ammoFilter.value,
      rating: ratingFilter.value,
      element: elementFilter.value,
      champ: champFilter.value,
    };

    let visible = 0;
    const parts = [];
    const span = 14;

    for (const section of DATA.sections) {
      const weapons = (section.weapons || [])
        .filter((w) => matchesFilters(w, filters))
        .map((w) => ({ weapon: w, display: resolveDisplay(w, viewPve, viewPvp) }))
        .filter((item) => item.display.visible);

      visible += weapons.length;

      const rows =
        weapons.length > 0
          ? weapons
              .map((item, i) =>
                weaponRows(
                  item.weapon,
                  item.display.showPve,
                  item.display.showPvp,
                  i % 2 === 0 ? "row-a" : "row-b"
                )
              )
              .join("")
          : `<tr class="empty-row"><td colspan="${span}">${
              (section.weapons || []).length === 0
                ? "此途径暂无武器，请在编辑器中添加"
                : "当前筛选条件下无匹配武器"
            }</td></tr>`;

      const collapsed =
        weapons.length === 0 && (section.weapons || []).length > 0
          ? " collapsed"
          : "";

      parts.push(`
        <section class="section${collapsed}" data-section="${escapeHtml(section.id || section.title)}">
          <button type="button" class="section-header" aria-expanded="${collapsed ? "false" : "true"}">
            <div class="section-title">
              <h2>${escapeHtml(section.title)}</h2>
              <span class="section-count">${weapons.length} / ${(section.weapons || []).length} 把</span>
            </div>
            <span class="section-chevron" aria-hidden="true"></span>
          </button>
          <div class="section-body">
            <div class="table-wrap">
              <table class="weapon-table">
                ${colGroup()}
                ${tableHead()}
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </section>
      `);
    }

    countVisible.textContent = String(visible);

    if (parts.length === 0) {
      root.innerHTML = '<p class="no-results">没有可显示的分块。</p>';
      return;
    }

    root.innerHTML = `<div class="sections">${parts.join("")}</div>`;

    root.querySelectorAll(".section-header").forEach((btn) => {
      btn.addEventListener("click", () => {
        const section = btn.closest(".section");
        const collapsed = section.classList.toggle("collapsed");
        btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      });
    });
  }

  searchInput.addEventListener("input", render);
  typeFilter.addEventListener("change", render);
  ammoFilter.addEventListener("change", render);
  ratingFilter.addEventListener("change", render);
  elementFilter.addEventListener("change", render);
  champFilter.addEventListener("change", render);
  viewShowPve.addEventListener("change", render);
  viewShowPvp.addEventListener("change", render);
  resetBtn.addEventListener("click", () => {
    searchInput.value = "";
    typeFilter.value = "";
    ammoFilter.value = "";
    ratingFilter.value = "";
    elementFilter.value = "";
    champFilter.value = "";
    viewShowPve.checked = true;
    viewShowPvp.checked = true;
    render();
  });

  render();
})();
