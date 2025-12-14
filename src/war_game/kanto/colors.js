// war-game-online-web/src/war_game/kanto/colors.js

export const OWNER_COLORS = {
  F1: "#e6194b",
  F2: "#3cb44b",
  F3: "#ffe119",
  F4: "#4363d8",
  F5: "#f58231",
  F6: "#911eb4",
  F7: "#46f0f0",
  F8: "#f032e6",
  NEUTRAL: "#aaaaaa",
};

function isDark(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // 簡易輝度
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  return y < 140;
}

export function getOwnerColor(owner) {
  if (!owner) return OWNER_COLORS.NEUTRAL;
  return OWNER_COLORS[owner] || OWNER_COLORS.NEUTRAL;
}

export function getOwnerTextColor(owner) {
  const c = getOwnerColor(owner);
  return isDark(c) ? "#ffffff" : "#000000";
}
