(function () {
  const root = document.getElementById("app");
  const searchInput = document.getElementById("search");
  const typeFilter = document.getElementById("filter-type");
  const ammoFilter = document.getElementById("filter-ammo");
  const sectionFilter = document.getElementById("filter-section");
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
  const lastUpdated = document.getElementById("last-updated");
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

  const updatedText = formatUpdatedAt(DATA.updatedAt);
  if (lastUpdated) {
    if (updatedText) {
      lastUpdated.hidden = false;
      lastUpdated.textContent = `最后更新 ${updatedText}`;
    } else {
      lastUpdated.hidden = true;
      lastUpdated.textContent = "";
    }
  }

  const totalWeapons = Array.isArray(DATA.weapons)
    ? DATA.weapons.length
    : DATA.sections.reduce(
        (sum, s) => sum + (s.weaponIds?.length || s.weapons?.length || 0),
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

  // 填充获取途径选项
  DATA.sections.forEach((section) => {
    const opt = document.createElement("option");
    opt.value = section.id || section.title;
    opt.textContent = section.title || section.id || "未命名途径";
    sectionFilter.appendChild(opt);
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
        weapon.rpm,
        weapon.element,
        weapon.antiChamp,
        weapon.ratingPve,
        weapon.ratingPvp,
        weapon.perk1Pve,
        weapon.perk2Pve,
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

  function nameCell(weapon, rowspan) {
    const text = String(weapon?.name || "").trim() || "—";
    const hash = resolveWeaponItemHash(weapon);
    const url = lightggItemUrl(hash);
    if (!url || text === "—") {
      return td(escapeHtml(text), "name-cell", rowspan, text);
    }
    const inner = `<a class="weapon-name-link" href="${escapeHtml(
      url
    )}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
    return td(inner, "name-cell", rowspan, text);
  }

  function plainCell(value, extraClass, rowspan) {
    const text = value || "—";
    return td(escapeHtml(text), extraClass, rowspan, text);
  }

  function tintCell(value, className, extraClass, rowspan) {
    const text = value || "—";
    return td(tint(text, className), extraClass, rowspan, text);
  }

  function frameCell(weapon, rowspan) {
    const frame = String(weapon.frame || "").trim();
    const rpm = String(weapon.rpm || "").trim();
    const rs = rowspan > 1 ? ` rowspan="${rowspan}"` : "";
    let inner = "—";
    let tip = "";
    if (frame && rpm) {
      inner = `<span class="frame-line">${escapeHtml(frame)}</span><span class="frame-line">${escapeHtml(rpm)}</span>`;
      tip = ` title="${escapeHtml(`${frame} / ${rpm}`)}"`;
    } else if (frame || rpm) {
      const only = frame || rpm;
      inner = `<span class="frame-line">${escapeHtml(only)}</span>`;
      tip = ` title="${escapeHtml(only)}"`;
    }
    return `<td class="frame-cell"${rs}${tip}>${inner}</td>`;
  }

  function baseCells(weapon, rowspan) {
    return [
      nameCell(weapon, rowspan),
      plainCell(weapon.weaponType, "type-cell", rowspan),
      tintCell(weapon.ammoType, ammoClass(weapon.ammoType), "", rowspan),
      tintCell(weapon.ratingPve, ratingClass(weapon.ratingPve), "cell-pve", rowspan),
      tintCell(weapon.ratingPvp, ratingClass(weapon.ratingPvp), "cell-pvp", rowspan),
      frameCell(weapon, rowspan),
      tintCell(weapon.element, elementClass(weapon.element), "", rowspan),
      plainCell(weapon.antiChamp, "champ", rowspan),
    ].join("");
  }

  function noteCell(weapon, rowspan) {
    const text = weapon.note || "";
    if (!text) return td("—", "note-cell", rowspan, "");
    const inner = `<span class="note-text">${escapeHtml(text)}</span>`;
    return td(inner, "note-cell", rowspan, text);
  }

  function weaponSourceLabels(weaponId) {
    const ids = weaponSectionIds(DATA, weaponId);
    const titleById = new Map(
      (DATA.sections || []).map((section) => [
        section.id,
        section.title || section.id,
      ])
    );
    return ids
      .map((id) => titleById.get(id) || id)
      .map((title) => String(title || "").trim())
      .filter(Boolean);
  }

  /** 获取途径列（始终完整显示，多来源时分行） */
  function sourcesCell(weapon, rowspan) {
    const labels = weaponSourceLabels(weapon.id);
    const rs = rowspan > 1 ? ` rowspan="${rowspan}"` : "";
    if (!labels.length) {
      return `<td class="sources-cell"${rs}>—</td>`;
    }
    const tip = labels.join(" / ");
    const inner = labels
      .map((label) => `<span class="sources-line">${escapeHtml(label)}</span>`)
      .join("");
    return `<td class="sources-cell"${rs} title="${escapeHtml(tip)}">${inner}</td>`;
  }

  function cell(value, extraClass) {
    return plainCell(value, extraClass, 1);
  }

  /** Perk 含 `/` 时在查看页格内分行（不显示斜杠） */
  function perkCell(value, extraClass) {
    const raw = String(value || "").trim();
    if (!raw) return td("—", extraClass, 1, "—");
    if (!raw.includes("/")) {
      return td(escapeHtml(raw), extraClass, 1, raw);
    }
    const parts = raw
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length <= 1) {
      return td(escapeHtml(raw), extraClass, 1, raw);
    }
    const inner = parts
      .map((part) => `<span class="perk-line">${escapeHtml(part)}</span>`)
      .join("");
    const cls = extraClass ? `${extraClass} perk-multiline` : "perk-multiline";
    return td(inner, cls, 1, raw);
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
      ${perkCell(weapon.perk1Pve, "perk-cell cell-pve")}
      ${perkCell(weapon.perk2Pve, "perk-cell cell-pve")}
      ${perkCell(weapon.perk3Pve, "perk-cell cell-pve")}
      ${perkCell(weapon.perk4Pve, "perk-cell cell-pve")}
    `;
  }

  function bothPerkCellsPvp(weapon) {
    return `
      <td class="mode-tag-cell cell-pvp">PVP</td>
      ${perkCell(weapon.perk1Pvp, "perk-cell cell-pvp")}
      ${perkCell(weapon.perk2Pvp, "perk-cell cell-pvp")}
      ${perkCell(weapon.perk3Pvp, "perk-cell cell-pvp")}
      ${perkCell(weapon.perk4Pvp, "perk-cell cell-pvp")}
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

  function weaponRows(weapon, showPve, showPvp, pairClass, showSources) {
    const sourcePart = (rowspan) =>
      showSources ? sourcesCell(weapon, rowspan) : "";

    if (showPve && showPvp) {
      return `
        <tr class="weapon-row ${pairClass}">
          ${baseCells(weapon, 2)}
          ${bothPerkCellsPve(weapon)}
          ${sourcePart(2)}
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
          ${sourcePart(1)}
          ${noteCell(weapon, 1)}
        </tr>
      `;
    }

    if (showPvp) {
      return `
        <tr class="weapon-row ${pairClass}">
          ${baseCells(weapon, 1)}
          ${bothPerkCellsPvp(weapon)}
          ${sourcePart(1)}
          ${noteCell(weapon, 1)}
        </tr>
      `;
    }

    return `
      <tr class="weapon-row ${pairClass}">
        ${baseCells(weapon, 1)}
        ${emptyPerkCells()}
        ${sourcePart(1)}
        ${noteCell(weapon, 1)}
      </tr>
    `;
  }

  function colGroup(showSources) {
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
      ${showSources ? '<col class="col-sources" />' : ""}
      <col class="col-note" />
    </colgroup>`;
  }

  function tableHead(showSources) {
    return `
      <thead>
        <tr>
          <th rowspan="2">武器名</th>
          <th rowspan="2">武器类型</th>
          <th rowspan="2">弹药类型</th>
          <th class="th-pve" rowspan="2">PVE评级</th>
          <th class="th-pvp" rowspan="2">PVP评级</th>
          <th rowspan="2">框架/射速</th>
          <th rowspan="2">属性</th>
          <th rowspan="2">反勇士</th>
          <th class="th-group" colspan="5">Perk 组合</th>
          ${showSources ? '<th rowspan="2">获取途径</th>' : ""}
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

  function renderWeaponTable(weapons, showSources, emptyMessage) {
    const span = showSources ? 15 : 14;
    const rows =
      weapons.length > 0
        ? weapons
            .map((item, i) =>
              weaponRows(
                item.weapon,
                item.display.showPve,
                item.display.showPvp,
                i % 2 === 0 ? "row-a" : "row-b",
                showSources
              )
            )
            .join("")
        : `<tr class="empty-row"><td colspan="${span}">${emptyMessage}</td></tr>`;

    return `
      <div class="table-wrap">
        <table class="weapon-table${showSources ? " weapon-table-with-sources" : ""}">
          ${colGroup(showSources)}
          ${tableHead(showSources)}
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function render() {
    const viewPve = viewShowPve.checked;
    const viewPvp = viewShowPvp.checked;

    const filters = {
      q: searchInput.value.trim().toLowerCase(),
      weaponType: typeFilter.value,
      ammoType: ammoFilter.value,
      sectionId: sectionFilter.value,
      element: elementFilter.value,
      champ: champFilter.value,
    };

    const showSources = !filters.sectionId;
    let visible = 0;
    const parts = [];

    if (showSources) {
      const catalog = Array.isArray(DATA.weapons) ? DATA.weapons : [];
      const weapons = catalog
        .filter((w) => matchesFilters(w, filters))
        .map((w) => ({
          weapon: w,
          display: resolveDisplay(w, viewPve, viewPvp),
        }))
        .filter((item) => item.display.visible);

      visible = weapons.length;
      parts.push(`
        <section class="section" data-section="all">
          <div class="section-header section-header-static">
            <div class="section-title">
              <h2>全部武器</h2>
              <span class="section-count">${weapons.length} / ${catalog.length} 把</span>
            </div>
          </div>
          <div class="section-body">
            ${renderWeaponTable(
              weapons,
              true,
              catalog.length === 0
                ? "暂无武器，请在编辑器中添加"
                : "当前筛选条件下无匹配武器"
            )}
          </div>
        </section>
      `);
    } else {
      for (const section of DATA.sections) {
        const sectionKey = section.id || section.title;
        if (sectionKey !== filters.sectionId) continue;

        const sectionWeapons = resolveSectionWeapons(DATA, section);
        const weapons = sectionWeapons
          .filter((w) => matchesFilters(w, filters))
          .map((w) => ({
            weapon: w,
            display: resolveDisplay(w, viewPve, viewPvp),
          }))
          .filter((item) => item.display.visible);

        visible += weapons.length;

        const collapsed =
          weapons.length === 0 && sectionWeapons.length > 0
            ? " collapsed"
            : "";

        parts.push(`
          <section class="section${collapsed}" data-section="${escapeHtml(section.id || section.title)}">
            <button type="button" class="section-header" aria-expanded="${collapsed ? "false" : "true"}">
              <div class="section-title">
                <h2>${escapeHtml(section.title)}</h2>
                <span class="section-count">${weapons.length} / ${sectionWeapons.length} 把</span>
              </div>
              ${
                String(section.note || "").trim()
                  ? `<span class="section-note">${escapeHtml(String(section.note).trim())}</span>`
                  : `<span class="section-note section-note-empty" aria-hidden="true"></span>`
              }
              <span class="section-chevron" aria-hidden="true"></span>
            </button>
            <div class="section-body">
              ${renderWeaponTable(
                weapons,
                false,
                sectionWeapons.length === 0
                  ? "此途径暂无武器，请在编辑器中添加"
                  : "当前筛选条件下无匹配武器"
              )}
            </div>
          </section>
        `);
      }
    }

    countVisible.textContent = String(visible);

    if (parts.length === 0) {
      root.innerHTML = '<p class="no-results">没有可显示的分块。</p>';
      return;
    }

    root.innerHTML = `<div class="sections">${parts.join("")}</div>`;

    root.querySelectorAll(".section-header:not(.section-header-static)").forEach((btn) => {
      btn.addEventListener("click", () => {
        const section = btn.closest(".section");
        const collapsed = section.classList.toggle("collapsed");
        btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      });
    });

    bindTableHScroll();
  }

  /** 窗口底部固定横向滚动条，与表格区域横向滚动同步 */
  let hScrollBound = false;
  let hScrollSyncing = false;

  function bindTableHScroll() {
    const bar = document.getElementById("table-hscroll");
    const spacer = bar?.querySelector(".table-hscroll-spacer");
    const wrap = root.querySelector(".table-wrap");
    const table = wrap?.querySelector("table");
    if (!bar || !spacer) return;

    function layout() {
      if (!wrap || !table || !wrap.isConnected) {
        bar.hidden = true;
        bar.setAttribute("aria-hidden", "true");
        document.body.classList.remove("has-table-hscroll");
        return;
      }
      const rect = wrap.getBoundingClientRect();
      const need = table.scrollWidth > wrap.clientWidth + 1;
      bar.hidden = !need;
      bar.setAttribute("aria-hidden", need ? "false" : "true");
      document.body.classList.toggle("has-table-hscroll", need);
      if (!need) return;

      bar.style.left = `${Math.max(0, rect.left)}px`;
      bar.style.width = `${Math.max(0, rect.width)}px`;
      spacer.style.width = `${table.scrollWidth}px`;
      if (!hScrollSyncing) bar.scrollLeft = wrap.scrollLeft;
    }

    if (!hScrollBound) {
      hScrollBound = true;
      bar.addEventListener("scroll", () => {
        const currentWrap = root.querySelector(".table-wrap");
        if (!currentWrap || hScrollSyncing) return;
        hScrollSyncing = true;
        currentWrap.scrollLeft = bar.scrollLeft;
        hScrollSyncing = false;
      });
      window.addEventListener("scroll", layout, { passive: true });
      window.addEventListener("resize", layout);
    }

    wrap.addEventListener("scroll", () => {
      if (hScrollSyncing || bar.hidden) return;
      hScrollSyncing = true;
      bar.scrollLeft = wrap.scrollLeft;
      hScrollSyncing = false;
    });

    requestAnimationFrame(layout);
  }

  searchInput.addEventListener("input", render);
  typeFilter.addEventListener("change", render);
  ammoFilter.addEventListener("change", render);
  sectionFilter.addEventListener("change", render);
  elementFilter.addEventListener("change", render);
  champFilter.addEventListener("change", render);
  viewShowPve.addEventListener("change", render);
  viewShowPvp.addEventListener("change", render);
  resetBtn.addEventListener("click", () => {
    searchInput.value = "";
    typeFilter.value = "";
    ammoFilter.value = "";
    sectionFilter.value = "";
    elementFilter.value = "";
    champFilter.value = "";
    viewShowPve.checked = true;
    viewShowPvp.checked = true;
    render();
  });

  render();
})();
