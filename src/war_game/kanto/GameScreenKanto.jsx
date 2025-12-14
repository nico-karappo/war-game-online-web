// src/war_game/kanto/GameScreenKanto.jsx
import React, { useEffect, useMemo, useState } from "react";
import KantoMapCanvas from "./KantoMapCanvas";
import { COUNTRIES, buildAdjacency } from "./kantoMapDef";
import { fetchGameState, submitPlayerAction } from "./api";

/**
 * @param {{
 *  gameId: string,
 *  playerFaction: string,   // "A"/"B"/"C"/"D" 等
 *  pollIntervalMs?: number,
 * }} props
 */
export default function GameScreenKanto({ gameId, playerFaction, pollIntervalMs = 1000 }) {
  const [gameState, setGameState] = useState(null);
  const [selectedCountryId, setSelectedCountryId] = useState(null);

  const [actionKind, setActionKind] = useState("internal");
  const [conscriptNum, setConscriptNum] = useState("0");
  const [sortieTargetId, setSortieTargetId] = useState("");
  const [sendSoldiers, setSendSoldiers] = useState("0");
  const [sendPeasants, setSendPeasants] = useState("0");

  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");

  const adjacency = useMemo(() => buildAdjacency(), []);

  // 定期ポーリング（Firestore onSnapshot に置き換えてもOK）
  useEffect(() => {
    let timerId = null;
    let canceled = false;

    async function tick() {
      try {
        const data = await fetchGameState(gameId);
        if (!canceled) setGameState(data);
      } catch (e) {
        if (!canceled) setErr(String(e?.message ?? e));
      }
    }

    tick();
    timerId = setInterval(tick, pollIntervalMs);

    return () => {
      canceled = true;
      if (timerId) clearInterval(timerId);
    };
  }, [gameId, pollIntervalMs]);

  const selectedCountry = selectedCountryId ? gameState?.countries?.[selectedCountryId] : null;

  const attackableCountryIds = useMemo(() => {
    if (!selectedCountryId) return null;
    if (actionKind !== "sortie") return null;

    const nbs = adjacency[selectedCountryId] || [];
    const s = new Set(nbs);
    // 自分自身は攻撃対象ではないので除外（灰色にならないようにしたいなら add してもOK）
    return s;
  }, [actionKind, adjacency, selectedCountryId]);

  const sortieTargets = useMemo(() => {
    if (!selectedCountryId) return [];
    const nbs = adjacency[selectedCountryId] || [];
    return nbs.map((cid) => ({
      id: cid,
      name: COUNTRIES[cid]?.name ?? cid,
    }));
  }, [adjacency, selectedCountryId]);

  function resetInputsForCountry(cid) {
    setActionKind("internal");
    setConscriptNum("0");
    setSortieTargetId("");
    setSendSoldiers("0");
    setSendPeasants("0");

    // 出兵先は隣接があれば先頭をデフォで入れる
    const nbs = adjacency[cid] || [];
    if (nbs.length > 0) setSortieTargetId(nbs[0]);
  }

  function handleSelectCountry(cid) {
    setSelectedCountryId(cid);
    setErr("");
    setStatus("");
    resetInputsForCountry(cid);
  }

  function validateAndBuildAction() {
    if (!selectedCountryId) throw new Error("国が選択されていません。");
    const c = gameState?.countries?.[selectedCountryId];
    if (!c) throw new Error("選択した国の状態が見つかりません。");

    // 自分の国だけ操作できる想定（オンライン仕様に合わせて調整）
    if (c.owner !== playerFaction) {
      throw new Error(`あなた（${playerFaction}）が支配していない国です。`);
    }

    if (actionKind === "internal") {
      return { kind: "internal" };
    }

    if (actionKind === "conscript") {
      const n = parseInt(conscriptNum, 10);
      if (!Number.isFinite(n)) throw new Error("徴兵数が不正です。");

      // Pythonルール同様：最低1人農民を残す
      const maxCon = Math.max(0, (c.peasants || 0) - 1);
      if (n < 0 || n > maxCon) throw new Error(`徴兵数は 0〜${maxCon} で指定してください。`);

      return { kind: "conscript", conscript_num: n };
    }

    if (actionKind === "sortie") {
      const tgt = sortieTargetId;
      if (!tgt) throw new Error("出兵先が選択されていません。");
      const nbs = adjacency[selectedCountryId] || [];
      if (nbs.length > 0 && !nbs.includes(tgt)) {
        throw new Error("道が繋がっていない国には出兵できません。");
      }

      const s = parseInt(sendSoldiers, 10);
      const p = parseInt(sendPeasants, 10);
      if (!Number.isFinite(s) || !Number.isFinite(p)) throw new Error("出兵人数が不正です。");

      const maxS = c.soldiers || 0;
      const maxP = c.peasants || 0;
      if (s < 0 || s > maxS) throw new Error(`兵士は 0〜${maxS} で指定してください。`);
      if (p < 0 || p > maxP) throw new Error(`農民は 0〜${maxP} で指定してください。`);
      if (s === 0 && p === 0) throw new Error("兵士・農民どちらかは1以上にしてください。");

      return {
        kind: "sortie",
        target_country_id: tgt,
        send_soldiers: s,
        send_peasants: p,
      };
    }

    throw new Error("未知の行動種別です。");
  }

  async function handleSubmitAction() {
    setErr("");
    setStatus("");

    try {
      if (!gameState) throw new Error("ゲーム状態がまだ取得できていません。");
      const action = validateAndBuildAction();

      await submitPlayerAction(gameId, playerFaction, selectedCountryId, action);
      setStatus("行動を送信しました。サーバーの反映を待っています…");
    } catch (e) {
      setErr(String(e?.message ?? e));
    }
  }

  const isFinished = Boolean(gameState?.winner || gameState?.is_draw);

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "0 0 auto" }}>
        <div style={{ marginBottom: 8, fontFamily: "Meiryo", fontSize: 14 }}>
          <b>Game:</b> {gameId}　<b>あなたの勢力:</b> {playerFaction}　<b>ターン:</b>{" "}
          {gameState?.turn ?? "--"}
          {gameState?.winner ? (
            <span style={{ marginLeft: 12 }}><b>勝者:</b> {gameState.winner}</span>
          ) : null}
          {gameState?.is_draw ? (
            <span style={{ marginLeft: 12 }}><b>引き分け</b></span>
          ) : null}
        </div>

        <KantoMapCanvas
          gameState={gameState}
          selectedCountryId={selectedCountryId}
          attackableCountryIds={attackableCountryIds}
          onSelectCountry={handleSelectCountry}
        />
      </div>

      <div style={{ flex: "1 1 320px", minWidth: 320, fontFamily: "Meiryo" }}>
        <div style={{ padding: 12, border: "1px solid rgba(0,0,0,0.2)", borderRadius: 8 }}>
          <div style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>操作パネル</div>

          <div style={{ marginBottom: 8 }}>
            <b>選択中の国:</b>{" "}
            {selectedCountryId ? (COUNTRIES[selectedCountryId]?.name ?? selectedCountryId) : "なし"}
          </div>

          {selectedCountry ? (
            <div style={{ marginBottom: 12, fontSize: 14 }}>
              <div>支配者: {selectedCountry.owner ?? "中立"}</div>
              <div>農民: {selectedCountry.peasants ?? 0}</div>
              <div>兵士: {selectedCountry.soldiers ?? 0}</div>
            </div>
          ) : (
            <div style={{ marginBottom: 12, fontSize: 14, opacity: 0.8 }}>
              マップ上の国をクリックして選択してください。
            </div>
          )}

          <fieldset style={{ border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: 10 }}>
            <legend style={{ padding: "0 6px" }}>行動</legend>

            <label style={{ display: "block", marginBottom: 6 }}>
              <input
                type="radio"
                name="action"
                value="internal"
                checked={actionKind === "internal"}
                onChange={() => setActionKind("internal")}
              />
              <span style={{ marginLeft: 6 }}>内政</span>
            </label>

            <label style={{ display: "block", marginBottom: 6 }}>
              <input
                type="radio"
                name="action"
                value="conscript"
                checked={actionKind === "conscript"}
                onChange={() => setActionKind("conscript")}
              />
              <span style={{ marginLeft: 6 }}>徴兵</span>
            </label>

            {actionKind === "conscript" ? (
              <div style={{ marginLeft: 22, marginBottom: 8 }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  徴兵数（農民を最低1人残す）
                </div>
                <input
                  type="number"
                  value={conscriptNum}
                  min={0}
                  onChange={(e) => setConscriptNum(e.target.value)}
                  style={{ width: 120 }}
                />
              </div>
            ) : null}

            <label style={{ display: "block", marginBottom: 6 }}>
              <input
                type="radio"
                name="action"
                value="sortie"
                checked={actionKind === "sortie"}
                onChange={() => setActionKind("sortie")}
              />
              <span style={{ marginLeft: 6 }}>出兵</span>
            </label>

            {actionKind === "sortie" ? (
              <div style={{ marginLeft: 22, marginBottom: 8 }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>出兵先（隣接国）</div>
                <select
                  value={sortieTargetId}
                  onChange={(e) => setSortieTargetId(e.target.value)}
                  style={{ width: 200 }}
                >
                  {sortieTargets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>兵士</div>
                    <input
                      type="number"
                      value={sendSoldiers}
                      min={0}
                      onChange={(e) => setSendSoldiers(e.target.value)}
                      style={{ width: 90 }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>農民</div>
                    <input
                      type="number"
                      value={sendPeasants}
                      min={0}
                      onChange={(e) => setSendPeasants(e.target.value)}
                      style={{ width: 90 }}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </fieldset>

          <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={handleSubmitAction}
              disabled={!selectedCountryId || isFinished}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.25)",
                cursor: (!selectedCountryId || isFinished) ? "not-allowed" : "pointer",
              }}
            >
              行動を送信
            </button>

            {isFinished ? (
              <span style={{ fontWeight: "bold" }}>ゲーム終了</span>
            ) : null}
          </div>

          {status ? (
            <div style={{ marginTop: 10, padding: 8, borderRadius: 8, background: "rgba(0,128,255,0.08)" }}>
              {status}
            </div>
          ) : null}

          {err ? (
            <div style={{ marginTop: 10, padding: 8, borderRadius: 8, background: "rgba(255,0,0,0.08)" }}>
              <b>エラー:</b> {err}
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 12, padding: 12, border: "1px solid rgba(0,0,0,0.2)", borderRadius: 8 }}>
          <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 6 }}>国一覧</div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            {gameState?.countries
              ? Object.keys(COUNTRIES).map((cid) => {
                  const c = gameState.countries[cid];
                  const name = COUNTRIES[cid]?.name ?? cid;
                  const owner = c?.owner ?? "中立";
                  const peas = c?.peasants ?? 0;
                  const sold = c?.soldiers ?? 0;
                  return (
                    <div key={cid}>
                      {name}: {owner}（農民 {peas}, 兵士 {sold}）
                    </div>
                  );
                })
              : "未取得"}
          </div>
        </div>
      </div>
    </div>
  );
}
