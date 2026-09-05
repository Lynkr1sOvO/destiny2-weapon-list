/**
 * ============================================================
 *  Destiny 2 本赛季武器清单 — 数据填写文件
 * ============================================================
 *  推荐用 editor.html 可视化编辑后「导出 data.js」覆盖本文件。
 *  每把武器可分别填写 PVE / PVP 评级与 Perk 组合。
 * ============================================================
 */

const WEAPON_DATA = {
  "seasonTitle": "凯旋纪念碑 全武器刷取清单",
  "seasonNote": "",
  "sections": [
    {
      "id": "seasonal",
      "title": "扭曲",
      "weapons": [
        {
          "name": "迪凯特02",
          "weaponType": "自动步枪",
          "ammoType": "主要",
          "ratingPve": "S",
          "ratingPvp": "C",
          "frame": "支援 · 600",
          "element": "冰影",
          "antiChamp": "势不可挡",
          "showPvePerk": true,
          "showPvpPerk": false,
          "perk3Pve": "医治/羸弱能量球",
          "perk4Pve": "互惠",
          "perk1Pvp": "",
          "perk2Pvp": "",
          "perk3Pvp": "",
          "perk4Pvp": "",
          "note": ""
        }
      ]
    },
    {
      "id": "vanguard",
      "title": "先锋作战 / 日落挑战",
      "weapons": []
    },
    {
      "id": "crucible",
      "title": "熔炉竞技场 / 试炼",
      "weapons": []
    },
    {
      "id": "gambit",
      "title": "博弈",
      "weapons": []
    },
    {
      "id": "vendor",
      "title": "商人兑换 / 聚焦",
      "weapons": []
    },
    {
      "id": "raid",
      "title": "突袭",
      "weapons": []
    },
    {
      "id": "dungeon",
      "title": "地牢",
      "weapons": []
    },
    {
      "id": "world",
      "title": "世界掉落 / 其他",
      "weapons": []
    }
  ]
};
