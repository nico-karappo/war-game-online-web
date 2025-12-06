// src/war_game/serverApi.js
// Firebase Functions（war-game-online-functions）側の HTTP エンドポイントを呼ぶラッパー
// - createNewGame
// - applyPlayerAction
// - requestAiAction

// ---- Functions のベース URL ----
const FUNCTIONS_BASE_URL =
  "https://us-central1-war-game-online-77a9a.cloudfunctions.net";

// -----------------------------
// 共通 fetch ヘルパー
// -----------------------------
async function postJson(path, body) {
  const url = `${FUNCTIONS_BASE_URL}/${path}`;

  const resp = await fetch(url, {
    method: "POST", // ★必ず POST
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `HTTP ${resp.status} ${resp.statusText} (${path})\n${text}`
    );
  }

  const data = await resp.json();

  // functions 側の ErrorResponse { ok:false, message } に対応
  if (data && data.ok === false) {
    throw new Error(data.message || "Server error");
  }

  return data;
}

// -----------------------------
// createNewGame ラッパー
// -----------------------------

/**
 * 新しい対戦用 GameState を作成する
 * @param {Object} req  省略可
 * @returns {Promise<{ ok: true, state: any }>}
 */
export async function createNewGame(req = {}) {
  return postJson("createNewGame", req);
}

// -----------------------------
// submitAction 相当（applyPlayerAction）
// -----------------------------

/**
 * 1ターン分のプレイヤー行動をサーバに送信して、
 * 進行後の GameState を受け取る。
 *
 * @param {{ state: any, actionsMap: Record<string, any> }} params
 * @returns {Promise<any>} 新しい GameState
 */
export async function submitAction(params) {
  const { state, actionsMap } = params;

  // サーバ側の型に合わせて配列に変換
  const actions = Object.entries(actionsMap).map(([cid, action]) => ({
    country_id: cid,
    action,
  }));

  const reqBody = {
    state,
    actions,
    expectedTurn: state.turn,
  };

  const res = await postJson("applyPlayerAction", reqBody);
  return res.state;
}

// -----------------------------
// AI 行動をサーバに問い合わせる
// -----------------------------

/**
 * サーバ上の exAI / basicAI に、指定国の行動を決めさせる。
 *
 * @param {{ state: any, countryId: string, aiLevel?: "strong"|"basic" }} req
 * @returns {Promise<any>} Action オブジェクト
 */
export async function requestAiAction(req) {
  const res = await postJson("requestAiAction", req);
  return res.action;
}
