// war-game-online-web/src/war_game/kanto/kantoMapDef.js

// ===== ベース画像サイズ（kanto.png のピクセル）=====
export const KANTO_BASE_W = 794;
export const KANTO_BASE_H = 898;

// ★ 画像配置に合わせて public/assets に統一
export const KANTO_BG_IMAGE_URL = "public/assets/kanto.png";
export const COUNTRY_ICON_URL = "public/assets/country.png";
export const ROAD_ICON_URL = "public/assets/road.png";

// ===== 国（都県）定義：画像上の矩形（ベース座標）=====
export const COUNTRIES = [
  { id: "tokyo", name: "東京", rect: { x1: 360, y1: 420, x2: 470, y2: 520 } },
  { id: "kanagawa", name: "神奈川", rect: { x1: 320, y1: 520, x2: 470, y2: 650 } },
  { id: "chiba", name: "千葉", rect: { x1: 470, y1: 470, x2: 620, y2: 650 } },
  { id: "saitama", name: "埼玉", rect: { x1: 330, y1: 320, x2: 500, y2: 420 } },
  { id: "ibaraki", name: "茨城", rect: { x1: 540, y1: 260, x2: 690, y2: 420 } },
  { id: "tochigi", name: "栃木", rect: { x1: 460, y1: 180, x2: 590, y2: 320 } },
  { id: "gunma", name: "群馬", rect: { x1: 310, y1: 180, x2: 460, y2: 320 } },
  { id: "yamanashi", name: "山梨", rect: { x1: 240, y1: 420, x2: 360, y2: 560 } },
];

// ===== 道路（隣接）定義：両方向の辺 =====
export const ROADS = [
  ["tokyo", "kanagawa"],
  ["tokyo", "chiba"],
  ["tokyo", "saitama"],
  ["tokyo", "yamanashi"],
  ["kanagawa", "yamanashi"],
  ["saitama", "gunma"],
  ["saitama", "tochigi"],
  ["saitama", "ibaraki"],
  ["tochigi", "ibaraki"],
  ["gunma", "tochigi"],
  ["chiba", "ibaraki"],
];

// ROADS から隣接リストを作る
export function buildAdjacency() {
  const adj = {};
  for (const c of COUNTRIES) adj[c.id] = new Set();

  for (const [a, b] of ROADS) {
    if (!adj[a]) adj[a] = new Set();
    if (!adj[b]) adj[b] = new Set();
    adj[a].add(b);
    adj[b].add(a);
  }
  return adj;
}

export function getCountryDefById(id) {
  return COUNTRIES.find((c) => c.id === id) || null;
}
