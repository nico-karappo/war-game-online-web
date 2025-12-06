// src/war_game/serverApi.js
// Firebase Functions（war-game-online-functions）側の HTTP エンドポイントを呼ぶラッパー
// - createNewGameHttp
// - applyPlayerActionHttp
// - requestAiActionHttp

// ---- Functions のベース URL ----
// あなたのプロジェクトID & リージョン(us-central1)に合わせて固定
const FUNCTIONS_BASE_URL =
  "https://us-central1-war-game-online-77a9a.cloudfunctions.net";

// -----------------------------
// 共通 fetch ヘルパー
// -----------------------------
async function postJson(path, body) {
  const url = `${FUNCTIONS_BASE_URL}/${path}`;

  const resp = await fetch(url, {
    method: "POST",
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
 * - サーバの createNewGameHandler と同じ構造
 * @param {Object} req
 * @returns {Promise<{ ok: true, state: any }>}
 */
export async function createNewGame(req) {
  return postJson("createNewGameHttp", req);
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
    expectedTurn: state.turn, // サーバ側の expectedTurn チェックと合わせる
  };

  const res = await postJson("applyPlayerActionHttp", reqBody);
  // res は { ok:true, state: ... } の想定
  return res.state;
}

// -----------------------------
// AI 行動をサーバに問い合わせる（必要に応じて）
// -----------------------------

/**
 * サーバ上の exAI / basicAI に、指定国の行動を決めさせる。
 * - state: 現在の GameState
 * - countryId: 行動させたい国ID
 * - aiLevel: "strong"（ex_ai） or "basic"
 *
 * @param {{ state: any, countryId: string, aiLevel?: "strong"|"basic" }} req
 * @returns {Promise<any>} Action オブジェクト
 */
export async function requestAiAction(req) {
  const res = await postJson("requestAiActionHttp", req);
  return res.action;
}
