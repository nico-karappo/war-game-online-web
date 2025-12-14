// war-game-online-web/src/war_game/kanto/kanto_ui.js
import { COUNTRIES, KANTO_BASE_W, KANTO_BASE_H, KANTO_BG_IMAGE_URL, buildAdjacency } from "./kantoMapDef.js";
import { getOwnerColor, getOwnerTextColor } from "./colors.js";

function pageBaseUrl() {
  // /repo/index.html -> /repo/
  const p = window.location.pathname;
  return p.endsWith("/") ? p : p.replace(/\/[^/]*$/, "/");
}

function assetUrl(path) {
  const origin = window.location.origin;
  const base = pageBaseUrl();
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  return origin + base + normalizedPath;
}

function clampInt(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function createKantoUi(rootEl) {
  if (!rootEl) {
    return {
      setContext() {},
      setGameDoc() {},
      getActionsForSubmit() { return []; },
      destroy() {},
    };
  }

  // ----- state -----
  let ctx = { gameId: null, playerIndex: 0, lobbyUid: null };
  let latestGameDoc = null;
  let selectedCountryId = null;
  let hoverCountryId = null;

  // command inputs
  let actionKind = "internal"; // internal | conscript | sortie
  let conscriptNum = 0;
  let sortieTargetId = "";
  let sendSoldiers = 0;
  let sendPeasants = 0;

  const adj = buildAdjacency();

  // ----- DOM -----
  rootEl.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gridTemplateColumns = "1fr 320px";
  wrap.style.gap = "12px";
  wrap.style.alignItems = "start";

  // left: canvas
  const canvasWrap = document.createElement("div");
  canvasWrap.style.border = "1px solid #ccc";
  canvasWrap.style.borderRadius = "8px";
  canvasWrap.style.overflow = "hidden";
  canvasWrap.style.height = "620px";
  canvasWrap.style.background = "#fff";

  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvasWrap.appendChild(canvas);

  // right: panel
  const panel = document.createElement("div");
  panel.style.border = "1px solid #ccc";
  panel.style.borderRadius = "8px";
  panel.style.padding = "10px";
  panel.style.background = "#fafafa";

  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.style.marginBottom = "6px";
  title.textContent = "関東マップ UI（プロトタイプ）";
  panel.appendChild(title);

  const meta = document.createElement("div");
  meta.style.fontSize = "12px";
  meta.style.color = "#555";
  meta.style.whiteSpace = "pre-wrap";
  meta.style.marginBottom = "10px";
  panel.appendChild(meta);

  const selInfo = document.createElement("div");
  selInfo.style.fontSize = "13px";
  selInfo.style.marginBottom = "10px";
  panel.appendChild(selInfo);

  const hr1 = document.createElement("hr");
  panel.appendChild(hr1);

  const kindLabel = document.createElement("div");
  kindLabel.textContent = "行動種類";
  kindLabel.style.marginTop = "10px";
  kindLabel.style.fontWeight = "600";
  panel.appendChild(kindLabel);

  const kindSelect = document.createElement("select");
  kindSelect.style.width = "100%";
  kindSelect.innerHTML = `
    <option value="internal">内政</option>
    <option value="conscript">徴兵</option>
    <option value="sortie">出兵</option>
  `;
  kindSelect.value = actionKind;
  panel.appendChild(kindSelect);

  const conscriptBox = document.createElement("div");
  conscriptBox.style.marginTop = "10px";
  conscriptBox.style.display = "none";
  conscriptBox.innerHTML = `
    <div style="font-weight:600;">徴兵数（農民→兵士）</div>
    <input id="conscriptNum" type="number" min="0" step="1" style="width:100%;"/>
    <div style="font-size:12px;color:#666;margin-top:4px;">※選択した自国に対して適用</div>
  `;
  panel.appendChild(conscriptBox);

  const sortieBox = document.createElement("div");
  sortieBox.style.marginTop = "10px";
  sortieBox.style.display = "none";
  sortieBox.innerHTML = `
    <div style="font-weight:600;">出兵先</div>
    <select id="sortieTarget" style="width:100%;"></select>

    <div style="font-weight:600;margin-top:10px;">送る兵士数</div>
    <input id="sendSoldiers" type="number" min="0" step="1" style="width:100%;"/>

    <div style="font-weight:600;margin-top:10px;">送る農民数</div>
    <input id="sendPeasants" type="number" min="0" step="1" style="width:100%;"/>

    <div style="font-size:12px;color:#666;margin-top:4px;">※隣接国のみ選択可能</div>
  `;
  panel.appendChild(sortieBox);

  const debug = document.createElement("pre");
  debug.style.marginTop = "10px";
  debug.style.fontSize = "11px";
  debug.style.whiteSpace = "pre-wrap";
  debug.style.background = "#eef";
  debug.style.padding = "8px";
  debug.style.borderRadius = "6px";
  debug.textContent = "";
  panel.appendChild(debug);

  wrap.appendChild(canvasWrap);
  wrap.appendChild(panel);
  rootEl.appendChild(wrap);

  // ----- image -----
  const bgImg = new Image();
  let bgReady = false;
  bgImg.onload = () => {
    bgReady = true;
    render();
  };
  bgImg.onerror = (e) => {
    bgReady = false;
    console.error("Failed to load bg image:", bgImg.src, e);
    render();
  };
  bgImg.src = assetUrl(KANTO_BG_IMAGE_URL);

  // ----- canvas sizing / transform -----
  let cssW = 0;
  let cssH = 0;
  let scale = 1;
  let offX = 0;
  let offY = 0;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    cssW = rect.width;
    cssH = rect.height;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));

    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    // 描画座標を CSS px に揃える
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    scale = Math.min(cssW / KANTO_BASE_W, cssH / KANTO_BASE_H);
    const drawW = KANTO_BASE_W * scale;
    const drawH = KANTO_BASE_H * scale;
    offX = (cssW - drawW) / 2;
    offY = (cssH - drawH) / 2;
  }

  const ro = new ResizeObserver(() => {
    resizeCanvas();
    render();
  });
  ro.observe(canvasWrap);

  // ----- helpers -----
  function factionIdForPlayerIndex(idx) {
    // F1..F8 を想定
    const n = (idx ?? 0) + 1;
    return "F" + String(n);
  }

  function countryRectToScreen(rect) {
    return {
      x: offX + rect.x1 * scale,
      y: offY + rect.y1 * scale,
      w: (rect.x2 - rect.x1) * scale,
      h: (rect.y2 - rect.y1) * scale,
    };
  }

  function screenToBase(x, y) {
    return { bx: (x - offX) / scale, by: (y - offY) / scale };
  }

  function pickCountryByBasePoint(bx, by) {
    for (const c of COUNTRIES) {
      const r = c.rect;
      if (bx >= r.x1 && bx <= r.x2 && by >= r.y1 && by <= r.y2) return c.id;
    }
    return null;
  }

  function rebuildSortieTargets() {
    const sel = selectedCountryId;
    const targetSel = sortieBox.querySelector("#sortieTarget");
    if (!targetSel) return;

    targetSel.innerHTML = "";
    if (!sel) return;

    const neighbors = adj[sel] ? Array.from(adj[sel]) : [];
    for (const nid of neighbors) {
      const def = COUNTRIES.find((c) => c.id === nid);
      const opt = document.createElement("option");
      opt.value = nid;
      opt.textContent = def ? def.name : nid;
      targetSel.appendChild(opt);
    }

    // 既存選択が無効なら先頭へ
    if (neighbors.length === 0) {
      sortieTargetId = "";
    } else if (!neighbors.includes(sortieTargetId)) {
      sortieTargetId = neighbors[0];
      targetSel.value = sortieTargetId;
    }
  }

  function updatePanel() {
    const myFaction = factionIdForPlayerIndex(ctx.playerIndex);

    const turn =
      latestGameDoc && latestGameDoc.currentTurn != null
        ? latestGameDoc.currentTurn
        : latestGameDoc && latestGameDoc.state && latestGameDoc.state.turn != null
        ? latestGameDoc.state.turn
        : null;

    const phase =
      latestGameDoc && (latestGameDoc.phase ?? (latestGameDoc.state && (latestGameDoc.state.phase || latestGameDoc.state.stage || latestGameDoc.state.status)))
        ? (latestGameDoc.phase ?? latestGameDoc.state.phase ?? latestGameDoc.state.stage ?? latestGameDoc.state.status)
        : null;

    meta.textContent =
      `gameId: ${ctx.gameId ?? "-"}\n` +
      `playerIndex: ${ctx.playerIndex} (${myFaction})\n` +
      `turn: ${turn != null ? String(turn) : "-"}\n` +
      `phase: ${phase != null ? String(phase) : "-"}`;

    const selDef = COUNTRIES.find((c) => c.id === selectedCountryId);
    const selName = selDef ? selDef.name : "(未選択)";

    let owner = "-";
    let peas = "-";
    let sold = "-";
    if (latestGameDoc && latestGameDoc.state && latestGameDoc.state.countries && selectedCountryId) {
      const st = latestGameDoc.state.countries[selectedCountryId];
      if (st) {
        owner = st.owner ?? "-";
        peas = st.peasants ?? 0;
        sold = st.soldiers ?? 0;
      }
    }

    selInfo.textContent =
      `選択中: ${selName} (${selectedCountryId ?? "-"})\n` +
      `owner: ${owner}\n` +
      `peasants: ${peas}\n` +
      `soldiers: ${sold}`;

    // box visibility
    conscriptBox.style.display = actionKind === "conscript" ? "block" : "none";
    sortieBox.style.display = actionKind === "sortie" ? "block" : "none";

    // debug
    debug.textContent = JSON.stringify(
      {
        selectedCountryId,
        actionKind,
        conscriptNum,
        sortieTargetId,
        sendSoldiers,
        sendPeasants,
      },
      null,
      2,
    );
  }

  function render() {
    resizeCanvas();
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    // background
    ctx2d.clearRect(0, 0, cssW, cssH);
    ctx2d.save();
    ctx2d.translate(offX, offY);
    ctx2d.scale(scale, scale);

    if (bgReady) {
      ctx2d.drawImage(bgImg, 0, 0, KANTO_BASE_W, KANTO_BASE_H);
    } else {
      ctx2d.fillStyle = "#f3f3f3";
      ctx2d.fillRect(0, 0, KANTO_BASE_W, KANTO_BASE_H);
      ctx2d.fillStyle = "#666";
      ctx2d.font = "16px sans-serif";
      ctx2d.fillText("地図画像を読み込み中…", 20, 30);
      ctx2d.fillText(bgImg.src, 20, 55);
    }

    // overlay countries
    for (const c of COUNTRIES) {
      const st =
        latestGameDoc && latestGameDoc.state && latestGameDoc.state.countries
          ? latestGameDoc.state.countries[c.id]
          : null;

      const owner = st && st.owner ? st.owner : "NEUTRAL";
      const peas = st && Number.isFinite(st.peasants) ? st.peasants : 0;
      const sold = st && Number.isFinite(st.soldiers) ? st.soldiers : 0;

      const r = c.rect;

      // fill
      ctx2d.save();
      ctx2d.globalAlpha = 0.20;
      ctx2d.fillStyle = getOwnerColor(owner);
      ctx2d.fillRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
      ctx2d.restore();

      // border
      const isSel = c.id === selectedCountryId;
      const isHover = c.id === hoverCountryId;
      ctx2d.lineWidth = isSel ? 4 : isHover ? 3 : 2;
      ctx2d.strokeStyle = isSel ? "#ff0000" : isHover ? "#00aaff" : "#222";
      ctx2d.strokeRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);

      // label
      const cx = (r.x1 + r.x2) / 2;
      const cy = (r.y1 + r.y2) / 2;
      ctx2d.fillStyle = getOwnerTextColor(owner);
      ctx2d.font = "14px sans-serif";
      ctx2d.textAlign = "center";
      ctx2d.textBaseline = "middle";
      ctx2d.fillText(c.name, cx, cy - 10);
      ctx2d.font = "12px sans-serif";
      ctx2d.fillText(`${owner}`, cx, cy + 8);
      ctx2d.fillText(`農${peas} 兵${sold}`, cx, cy + 24);
    }

    ctx2d.restore();
    updatePanel();
  }

  // ----- events -----
  canvas.addEventListener("mousemove", (ev) => {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const { bx, by } = screenToBase(x, y);
    const cid = pickCountryByBasePoint(bx, by);
    if (cid !== hoverCountryId) {
      hoverCountryId = cid;
      render();
    }
  });

  canvas.addEventListener("mouseleave", () => {
    if (hoverCountryId != null) {
      hoverCountryId = null;
      render();
    }
  });

  canvas.addEventListener("click", (ev) => {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const { bx, by } = screenToBase(x, y);
    const cid = pickCountryByBasePoint(bx, by);
    if (cid) {
      selectedCountryId = cid;
      rebuildSortieTargets();
      render();
    }
  });

  kindSelect.addEventListener("change", () => {
    actionKind = kindSelect.value;
    rebuildSortieTargets();
    render();
  });

  conscriptBox.querySelector("#conscriptNum").addEventListener("input", (ev) => {
    conscriptNum = clampInt(ev.target.value, 0, 999999);
    render();
  });

  sortieBox.querySelector("#sortieTarget").addEventListener("change", (ev) => {
    sortieTargetId = ev.target.value || "";
    render();
  });

  sortieBox.querySelector("#sendSoldiers").addEventListener("input", (ev) => {
    sendSoldiers = clampInt(ev.target.value, 0, 999999);
    render();
  });

  sortieBox.querySelector("#sendPeasants").addEventListener("input", (ev) => {
    sendPeasants = clampInt(ev.target.value, 0, 999999);
    render();
  });

  // ----- public API -----
  function setContext(next) {
    ctx = { ...ctx, ...(next || {}) };
    // 自分の国を自動選択（初回）
    if (!selectedCountryId && latestGameDoc && latestGameDoc.state && latestGameDoc.state.countries) {
      const myFaction = factionIdForPlayerIndex(ctx.playerIndex);
      const mine = Object.keys(latestGameDoc.state.countries).find(
        (cid) => latestGameDoc.state.countries[cid] && latestGameDoc.state.countries[cid].owner === myFaction,
      );
      if (mine) selectedCountryId = mine;
    }
    rebuildSortieTargets();
    render();
  }

  function setGameDoc(g) {
    latestGameDoc = g;
    if (!selectedCountryId && g && g.state && g.state.countries) {
      const myFaction = factionIdForPlayerIndex(ctx.playerIndex);
      const mine = Object.keys(g.state.countries).find(
        (cid) => g.state.countries[cid] && g.state.countries[cid].owner === myFaction,
      );
      if (mine) selectedCountryId = mine;
    }
    rebuildSortieTargets();
    render();
  }

  // index.html 側の readyButton から呼ばれる想定：submitTurn に渡す actions を作る
  function getActionsForSubmit() {
    if (!selectedCountryId) return [];

    // 選択国の owner チェック（自国以外は基本弾く）
    const myFaction = factionIdForPlayerIndex(ctx.playerIndex);
    const st =
      latestGameDoc && latestGameDoc.state && latestGameDoc.state.countries
        ? latestGameDoc.state.countries[selectedCountryId]
        : null;

    if (!st || st.owner !== myFaction) {
      // とりあえず無効にする（自国以外を操作させない）
      return [];
    }

    let action = null;

    if (actionKind === "internal") {
      action = { kind: "internal" };
    } else if (actionKind === "conscript") {
      action = { kind: "conscript", conscript_num: clampInt(conscriptNum, 0, 999999) };
    } else if (actionKind === "sortie") {
      if (!sortieTargetId) return [];
      action = {
        kind: "sortie",
        target_country_id: sortieTargetId,
        send_soldiers: clampInt(sendSoldiers, 0, 999999),
        send_peasants: clampInt(sendPeasants, 0, 999999),
      };
    }

    if (!action) return [];

    return [
      {
        country_id: selectedCountryId,
        action,
      },
    ];
  }

  function destroy() {
    try { ro.disconnect(); } catch (_) {}
    rootEl.innerHTML = "";
  }

  // initial render
  resizeCanvas();
  render();

  return { setContext, setGameDoc, getActionsForSubmit, destroy };
}
