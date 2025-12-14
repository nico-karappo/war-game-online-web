// src/war_game/kanto/api.js
/**
 * ここだけ、あなたのオンライン版（Firebase Functions / Firestore / serverApi.js）に合わせて差し替えます。
 *
 * 期待するデータ形（例）:
 * {
 *   turn: number,
 *   winner: string|null,
 *   is_draw: boolean,
 *   countries: {
 *     [countryId]: { id, name, peasants, soldiers, owner }
 *   },
 *   armies: [
 *     { owner, fromCountryId, toCountryId, progress }  // progress 0.0〜1.0（無ければ0.5表示）
 *   ]
 * }
 */

export async function fetchGameState(gameId) {
  // ---- 例：HTTP で取る（あなたのFunctionsに合わせて変更）----
  const res = await fetch(`/api/getGameState?gameId=${encodeURIComponent(gameId)}`, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchGameState failed: ${res.status} ${text}`);
  }
  return await res.json();
}

/**
 * action 形（Python Action と同等イメージ）
 * { kind: "internal" }
 * { kind: "conscript", conscript_num: number }
 * { kind: "sortie", target_country_id: string, send_soldiers: number, send_peasants: number }
 */
export async function submitPlayerAction(gameId, playerFaction, countryId, action) {
  // ---- 例：HTTP で送る（あなたのFunctionsに合わせて変更）----
  const res = await fetch(`/api/submitAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      gameId,
      playerFaction,
      countryId,
      action,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`submitPlayerAction failed: ${res.status} ${text}`);
  }
  return await res.json();
}
