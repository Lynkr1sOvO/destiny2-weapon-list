/**
 * 生成项目内 share.html（供 GitHub Pages 等静态托管）
 * 用法：在项目目录执行  node build-share.mjs
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function read(name) {
  return fs.readFileSync(path.join(__dirname, name), "utf8");
}

function loadWeaponDataFromFile() {
  const code = read("data.js");
  const ctx = { console };
  vm.runInNewContext(`${code}\nthis.WEAPON_DATA = WEAPON_DATA;`, ctx);
  if (!ctx.WEAPON_DATA) throw new Error("data.js 中未找到 WEAPON_DATA");
  return ctx.WEAPON_DATA;
}

function loadBuilders() {
  const storageCode = read("storage.js");
  const builderCode = read("share-builder.js");
  let weaponsDbCode = "";
  try {
    weaponsDbCode = read("weapons-db.js");
  } catch {
    console.warn("未找到 weapons-db.js，分享页可能缺少 light.gg 链接 hash");
  }
  const ctx = {
    console,
    D2_SHARE_READONLY: undefined,
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
  };
  vm.runInNewContext(
    `${weaponsDbCode}\n${storageCode}\n${builderCode}\nthis.buildShareHtml = buildShareHtml;\nthis.normalizeWeaponData = normalizeWeaponData;`,
    ctx
  );
  if (typeof ctx.buildShareHtml !== "function") {
    throw new Error("未能加载 buildShareHtml");
  }
  return ctx;
}

const builders = loadBuilders();
const data = loadWeaponDataFromFile();
const html = builders.buildShareHtml(data, {
  css: read("styles.css"),
  storageJs: read("storage.js"),
  appJs: read("app.js"),
});

const out = path.join(__dirname, "share.html");
fs.writeFileSync(out, html, "utf8");
console.log("已写入", out);
