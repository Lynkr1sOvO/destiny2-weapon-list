/** 本地草稿：编辑页写入，清单页优先读取 */
const D2_STORAGE_KEY = "d2-weapon-list-draft";

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function loadWeaponData() {
  if (typeof D2_SHARE_READONLY !== "undefined" && D2_SHARE_READONLY) {
    return {
      data: backfillEmptyAntiChamp(normalizeWeaponData(WEAPON_DATA)),
      fromDraft: false,
    };
  }
  try {
    const raw = localStorage.getItem(D2_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sections)) {
        return {
          data: backfillEmptyAntiChamp(normalizeWeaponData(parsed)),
          fromDraft: true,
        };
      }
    }
  } catch (_) {
    /* ignore corrupt draft */
  }
  return {
    data: backfillEmptyAntiChamp(normalizeWeaponData(WEAPON_DATA)),
    fromDraft: false,
  };
}

/** 草稿/导出里空的反勇士：优先用 data.js 同 id，其次按 bungieHash 查武器库 */
function backfillEmptyAntiChamp(data) {
  if (!data || !Array.isArray(data.weapons)) return data;
  const fileList =
    typeof WEAPON_DATA !== "undefined" && Array.isArray(WEAPON_DATA.weapons)
      ? WEAPON_DATA.weapons
      : [];
  const byId = new Map(fileList.map((w) => [w.id, w]));
  const byHash = new Map(getWeaponsDbList().map((w) => [Number(w.hash), w]));

  for (const weapon of data.weapons) {
    if (weapon.antiChamp && String(weapon.antiChamp).trim()) continue;

    const fromFile = byId.get(weapon.id);
    if (fromFile?.antiChamp && String(fromFile.antiChamp).trim()) {
      weapon.antiChamp = fromFile.antiChamp;
      continue;
    }

    const hash = Number(weapon.bungieHash);
    if (Number.isFinite(hash) && hash > 0) {
      const entry = byHash.get(hash);
      if (entry?.antiChamp && String(entry.antiChamp).trim()) {
        weapon.antiChamp = entry.antiChamp;
      }
    }
  }
  return data;
}

function saveWeaponDraft(data) {
  touchUpdatedAt(data);
  localStorage.setItem(D2_STORAGE_KEY, JSON.stringify(data));
}

function clearWeaponDraft() {
  localStorage.removeItem(D2_STORAGE_KEY);
}

function touchUpdatedAt(data) {
  if (!data || typeof data !== "object") return data;
  data.updatedAt = new Date().toISOString();
  return data;
}

function formatUpdatedAt(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).trim();
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildDataJs(data) {
  const next = cloneData(data);
  touchUpdatedAt(next);
  const payload = JSON.stringify(next, null, 2);
  return `/**
 * ============================================================
 *  Destiny 2 本赛季武器清单 — 数据填写文件
 * ============================================================
 *  推荐用 editor.html 可视化编辑后「导出 data.js」覆盖本文件。
 *  每把武器可分别填写 PVE / PVP 评级与 Perk 组合。
 * ============================================================
 */

const WEAPON_DATA = ${payload};
`;
}

function downloadDataJs(data) {
  const blob = new Blob([buildDataJs(data)], {
    type: "text/javascript;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.js";
  a.click();
  URL.revokeObjectURL(url);
}

function emptyWeapon() {
  return {
    id: "",
    name: "",
    weaponType: "",
    ammoType: "",
    ratingPve: "",
    ratingPvp: "",
    frame: "",
    rpm: "",
    element: "",
    antiChamp: "",
    showPvePerk: true,
    showPvpPerk: true,
    perk1Pve: "",
    perk2Pve: "",
    perk3Pve: "",
    perk4Pve: "",
    perk1Pvp: "",
    perk2Pvp: "",
    perk3Pvp: "",
    perk4Pvp: "",
    bungieHash: null,
    seasonNumber: null,
    note: "",
  };
}

const WEAPON_TYPES = [
  "自动步枪",
  "微型冲锋枪",
  "手枪",
  "手炮",
  "脉冲步枪",
  "战斗弓箭",
  "斥候步枪",
  "霰弹枪",
  "追踪步枪",
  "融合步枪",
  "狙击步枪",
  "偃月",
  "火箭发射器",
  "线性融合步枪",
  "榴弹发射器",
  "机枪",
  "刀剑",
];

const AMMO_TYPES = ["主要", "特殊", "威能"];

const RATING_TIERS = [
  "S",
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D",
];

function ratingTierClass(rating) {
  const raw = String(rating || "").trim().toUpperCase();
  if (!raw) return "rating-empty";
  const normalized = raw.replace(/\s+/g, "");
  const map = {
    S: "rating-S",
    "A+": "rating-Ap",
    A: "rating-A",
    "A-": "rating-Am",
    "B+": "rating-Bp",
    B: "rating-B",
    "B-": "rating-Bm",
    "C+": "rating-Cp",
    C: "rating-C",
    "C-": "rating-Cm",
    D: "rating-D",
  };
  return map[normalized] || "rating-empty";
}

/** 旧译名 → 当前译名（兼容已保存草稿） */
const ELEMENT_ALIASES = {
  太阳: "烈日",
  弧光: "电弧",
  冻结: "冰影",
  源质: "缚丝",
};

const CHAMP_ALIASES = {
  破障: "屏障",
  压制: "势不可挡",
};

function normalizeElementName(element) {
  if (!element) return "";
  return ELEMENT_ALIASES[element] || element;
}

function normalizeChampName(value) {
  if (!value || value === "无") return "";
  const first = String(value)
    .split(/[/、,，]/)
    .map((part) => part.trim())
    .filter(Boolean)[0];
  if (!first || first === "无") return "";
  return CHAMP_ALIASES[first] || first;
}

function hasRollContent(weapon, mode) {
  const suffix = mode === "pvp" ? "Pvp" : "Pve";
  if (mode === "pve") {
    return Boolean(
      weapon.ratingPve ||
        weapon.perk1Pve ||
        weapon.perk2Pve ||
        weapon.perk3Pve ||
        weapon.perk4Pve
    );
  }
  return Boolean(
    weapon[`rating${suffix}`] ||
      weapon[`perk1${suffix}`] ||
      weapon[`perk2${suffix}`] ||
      weapon[`perk3${suffix}`] ||
      weapon[`perk4${suffix}`]
  );
}

function splitLegacyFrame(frame) {
  const raw = String(frame || "").trim();
  if (!raw) return { frame: "", rpm: "" };
  const parts = raw.split(/\s*[·•]\s*/);
  if (parts.length >= 2) {
    return {
      frame: parts[0].trim(),
      rpm: parts.slice(1).join(" · ").trim(),
    };
  }
  return { frame: raw, rpm: "" };
}

function formatFrameRpm(weapon) {
  const frame = String(weapon.frame || "").trim();
  const rpm = String(weapon.rpm || "").trim();
  if (frame && rpm) return `${frame}\n${rpm}`;
  return frame || rpm || "—";
}

function migrateLegacyWeapon(weapon) {
  const next = { ...emptyWeapon(), ...weapon };
  if (weapon && weapon.id) next.id = String(weapon.id);

  next.element = normalizeElementName(next.element);
  next.antiChamp = normalizeChampName(next.antiChamp);

  // 「弓箭」与「战斗弓箭」合并为战斗弓箭
  if (String(next.weaponType || "").trim() === "弓箭") {
    next.weaponType = "战斗弓箭";
  }

  // 框架展示名去掉末尾「框架」「帧」
  if (next.frame) {
    next.frame = String(next.frame)
      .trim()
      .replace(/框架$/u, "")
      .replace(/帧$/u, "");
  }

  // 旧单套字段 → 迁到 PVE（仅保留 3/4）
  if (weapon.rating && !weapon.ratingPve) next.ratingPve = weapon.rating;
  if (weapon.perk3 && !weapon.perk3Pve) next.perk3Pve = weapon.perk3;
  if (weapon.perk4 && !weapon.perk4Pve) next.perk4Pve = weapon.perk4;

  // 旧「框架 · 射速」合并字符串 → 拆成两栏
  if (!weapon.rpm && weapon.frame && /[·•]/.test(String(weapon.frame))) {
    const split = splitLegacyFrame(weapon.frame);
    next.frame = split.frame;
    next.rpm = split.rpm;
  } else if (typeof weapon.rpm !== "string") {
    next.rpm = weapon.rpm == null ? "" : String(weapon.rpm);
  }

  if (typeof weapon.showPvePerk !== "boolean") next.showPvePerk = true;
  if (typeof weapon.showPvpPerk !== "boolean") next.showPvpPerk = true;

  delete next.rating;
  delete next.perk1;
  delete next.perk2;
  delete next.perk3;
  delete next.perk4;
  delete next.originTrait;

  if (typeof next.perk1Pve !== "string") next.perk1Pve = "";
  if (typeof next.perk2Pve !== "string") next.perk2Pve = "";
  if (next.bungieHash == null || next.bungieHash === "") next.bungieHash = null;
  if (next.seasonNumber == null || next.seasonNumber === "") next.seasonNumber = null;

  return next;
}

function slugPart(value, maxLen) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]/g, "")
    .slice(0, maxLen || 20);
}

function makeStableWeaponId(sectionId, index, name) {
  const slug = slugPart(name, 20) || "item";
  return `w-${sectionId || "sec"}-${index}-${slug}`;
}

function makeWeaponId(name) {
  const slug = slugPart(name, 16) || "item";
  return `w-${slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function getWeaponMap(data) {
  const map = new Map();
  for (const weapon of data.weapons || []) {
    if (weapon?.id) map.set(weapon.id, weapon);
  }
  return map;
}

function resolveSectionWeapons(data, section) {
  const map = getWeaponMap(data);
  return (section?.weaponIds || [])
    .map((id) => map.get(id))
    .filter(Boolean);
}

function weaponSectionIds(data, weaponId) {
  if (!weaponId) return [];
  return (data.sections || [])
    .filter((section) => (section.weaponIds || []).includes(weaponId))
    .map((section) => section.id);
}

function purgeOrphanWeapons(data) {
  const used = new Set();
  for (const section of data.sections || []) {
    for (const id of section.weaponIds || []) used.add(id);
  }
  data.weapons = (data.weapons || []).filter((w) => w?.id && used.has(w.id));
}

function removeWeaponFromSection(data, weaponId, sectionId) {
  const section = (data.sections || []).find((s) => s.id === sectionId);
  if (!section) return;
  section.weaponIds = (section.weaponIds || []).filter((id) => id !== weaponId);
  if (!weaponSectionIds(data, weaponId).length) {
    data.weapons = (data.weapons || []).filter((w) => w.id !== weaponId);
  }
}

function addWeaponIdToSection(data, weaponId, sectionId) {
  const section = (data.sections || []).find((s) => s.id === sectionId);
  if (!section || !weaponId) return;
  if (!Array.isArray(section.weaponIds)) section.weaponIds = [];
  if (!section.weaponIds.includes(weaponId)) section.weaponIds.push(weaponId);
}

/** 同步一把武器所属途径（至少保留一个） */
function setWeaponSectionMembership(data, weaponId, sectionIds) {
  const wanted = [...new Set((sectionIds || []).filter(Boolean))];
  if (!wanted.length) return false;
  for (const section of data.sections || []) {
    const has = (section.weaponIds || []).includes(weaponId);
    const should = wanted.includes(section.id);
    if (should && !has) addWeaponIdToSection(data, weaponId, section.id);
    if (!should && has) {
      section.weaponIds = section.weaponIds.filter((id) => id !== weaponId);
    }
  }
  return true;
}

function normalizeWeaponData(data) {
  const next = cloneData(data);
  delete next.showPvePerk;
  delete next.showPvpPerk;
  if (typeof next.updatedAt !== "string") {
    next.updatedAt = next.updatedAt == null ? "" : String(next.updatedAt);
  }
  if (!Array.isArray(next.sections)) next.sections = [];
  if (!Array.isArray(next.weapons)) next.weapons = [];

  // 旧结构：sections[].weapons → 顶层 weapons + weaponIds
  for (const section of next.sections) {
    if (typeof section.note !== "string") {
      section.note = section.note == null ? "" : String(section.note);
    }
    if (!Array.isArray(section.weaponIds)) section.weaponIds = [];

    const nested = Array.isArray(section.weapons) ? section.weapons : [];
    if (nested.length) {
      nested.forEach((raw, index) => {
        const migrated = migrateLegacyWeapon(raw);
        const id =
          migrated.id ||
          makeStableWeaponId(section.id, index, migrated.name);
        migrated.id = id;
        if (!next.weapons.some((w) => w.id === id)) {
          next.weapons.push(migrated);
        }
        if (!section.weaponIds.includes(id)) section.weaponIds.push(id);
      });
    }
    delete section.weapons;
  }

  next.weapons = next.weapons.map((raw) => {
    const migrated = migrateLegacyWeapon(raw);
    if (!migrated.id) migrated.id = makeWeaponId(migrated.name);
    return migrated;
  });

  const validIds = new Set(next.weapons.map((w) => w.id));
  for (const section of next.sections) {
    section.weaponIds = (section.weaponIds || []).filter((id) =>
      validIds.has(id)
    );
  }

  purgeOrphanWeapons(next);
  return next;
}

function makeSectionId(title) {
  const base = String(title || "section")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]/g, "")
    .slice(0, 24);
  return `${base || "section"}-${Date.now().toString(36)}`;
}

function getWeaponsDbList() {
  if (typeof WEAPONS_DB !== "undefined" && Array.isArray(WEAPONS_DB.weapons)) {
    return WEAPONS_DB.weapons;
  }
  return [];
}

/** 解析 light.gg / Bungie 物品 hash：优先 bungieHash，否则按中文名（+赛季）查武器库 */
function resolveWeaponItemHash(weapon, dbList) {
  if (!weapon) return null;
  if (weapon.bungieHash != null && weapon.bungieHash !== "") {
    const n = Number(weapon.bungieHash);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (weapon.hash != null && weapon.hash !== "") {
    const n = Number(weapon.hash);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const list = dbList || getWeaponsDbList();
  if (!list.length) return null;
  const name = String(weapon.name || "").trim();
  if (!name) return null;
  const matches = list.filter((w) => String(w.name || "").trim() === name);
  if (!matches.length) return null;
  if (weapon.seasonNumber != null && weapon.seasonNumber !== "") {
    const season = Number(weapon.seasonNumber);
    const hit = matches.find((m) => m.seasonNumber === season);
    if (hit?.hash) return hit.hash;
  }
  matches.sort((a, b) => (b.seasonNumber || 0) - (a.seasonNumber || 0));
  return matches[0]?.hash || null;
}

function lightggItemUrl(hash) {
  if (hash == null || hash === "") return "";
  const n = Number(hash);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `https://www.light.gg/db/zh-chs/items/${n}`;
}

/** 导出分享页前尽量补齐 bungieHash，避免分享页不加载完整武器库 */
function enrichWeaponsWithBungieHash(data, dbList) {
  const list = dbList || getWeaponsDbList();
  const base = data && typeof data === "object" ? data : emptyWeaponData();
  const weapons = (base.weapons || []).map((raw) => {
    const weapon = { ...raw };
    const hash = resolveWeaponItemHash(weapon, list);
    if (hash != null) weapon.bungieHash = hash;
    return weapon;
  });
  return { ...base, weapons };
}
