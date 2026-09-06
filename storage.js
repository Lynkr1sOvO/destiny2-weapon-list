/** 本地草稿：编辑页写入，清单页优先读取 */
const D2_STORAGE_KEY = "d2-weapon-list-draft";

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function loadWeaponData() {
  if (typeof D2_SHARE_READONLY !== "undefined" && D2_SHARE_READONLY) {
    return { data: normalizeWeaponData(WEAPON_DATA), fromDraft: false };
  }
  try {
    const raw = localStorage.getItem(D2_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sections)) {
        return { data: normalizeWeaponData(parsed), fromDraft: true };
      }
    }
  } catch (_) {
    /* ignore corrupt draft */
  }
  return { data: normalizeWeaponData(WEAPON_DATA), fromDraft: false };
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
    perk3Pve: "",
    perk4Pve: "",
    perk1Pvp: "",
    perk2Pvp: "",
    perk3Pvp: "",
    perk4Pvp: "",
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

const RATING_TIERS = ["S", "A+", "A", "B+", "B", "C+", "C", "D"];

function ratingTierClass(rating) {
  const raw = String(rating || "").trim().toUpperCase();
  if (!raw) return "rating-empty";
  const normalized = raw.replace(/\s+/g, "");
  const map = {
    S: "rating-S",
    "A+": "rating-Ap",
    A: "rating-A",
    "B+": "rating-Bp",
    B: "rating-B",
    "C+": "rating-Cp",
    C: "rating-C",
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
      weapon.ratingPve || weapon.perk3Pve || weapon.perk4Pve
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

  next.element = normalizeElementName(next.element);
  next.antiChamp = normalizeChampName(next.antiChamp);

  // 「弓箭」与「战斗弓箭」合并为战斗弓箭
  if (String(next.weaponType || "").trim() === "弓箭") {
    next.weaponType = "战斗弓箭";
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
  delete next.perk1Pve;
  delete next.perk2Pve;

  return next;
}

function normalizeWeaponData(data) {
  const next = cloneData(data);
  delete next.showPvePerk;
  delete next.showPvpPerk;
  if (typeof next.updatedAt !== "string") {
    next.updatedAt = next.updatedAt == null ? "" : String(next.updatedAt);
  }
  for (const section of next.sections || []) {
    if (typeof section.note !== "string") {
      section.note = section.note == null ? "" : String(section.note);
    }
    section.weapons = (section.weapons || []).map(migrateLegacyWeapon);
  }
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
