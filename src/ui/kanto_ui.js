// src/ui/kanto_ui.js
// 関東マップUI（最小版）
// - public/assets/kanto.png を表示
// - 都県ボタンをクリックして from/to を選ぶ
// - 攻撃アクションをキューに積む
// - submitTurn へ渡す actions を返す

export function createKantoUi({ rootEl, mapImageUrl }) {
  if (!rootEl) throw new Error("createKantoUi: rootEl is required");

  const state = {
    context: { gameId: null, myPlayerIndex: null },
    gameDoc: null,
    selectedFrom: null,
    selectedTo: null,
    pendingActions: [],
  };

  // 画面DOMを構築
  rootEl.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "game-ui-wrap";

  const mapCol = document.createElement("div");
  const sideCol = document.createElement("div");

  // --- Map area ---
  const mapTitle = document.createElement("h3");
  mapTitle.textContent = "関東マップ（クリックで行動を作成）";
  mapCol.appendChild(mapTitle);

  const mapFrame = document.createElement("div");
  mapFrame.style.position = "relative";
  mapFrame.style.width = "100%";
  mapFrame.style.maxWidth = "794px";
  mapFrame.style.border = "1px solid #ccc";
  mapFrame.style.borderRadius = "8px";
  mapFrame.style.overflow = "hidden";
  mapFrame.style.background = "#fff";

  const mapImg = document.createElement("img");
  mapImg.src = mapImageUrl;
  mapImg.alt = "Kanto Map";
  mapImg.style.display = "block";
  mapImg.style.width = "100%";
  mapImg.style.height = "auto";
  mapFrame.appendChild(mapImg);

  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  mapFrame.appendChild(overlay);

  mapCol.appendChild(mapFrame);

  // --- Side area ---
  const sideTitle = document.createElement("h3");
  sideTitle.textContent = "行動キュー";
  sideCol.appendChild(sideTitle);

  const ctxInfo = document.createElement("div");
  ctxInfo.style.fontSize = "0.9em";
  ctxInfo.style.padding = "8px";
  ctxInfo.style.border = "1px solid #ddd";
  ctxInfo.style.borderRadius = "8px";
  ctxInfo.style.marginBottom = "8px";
  sideCol.appendChild(ctxInfo);

  const selInfo = document.createElement("div");
  selInfo.style.padding = "8px";
  selInfo.style.border = "1px solid #ddd";
  selInfo.style.borderRadius = "8px";
  selInfo.style.marginBottom = "8px";
  sideCol.appendChild(selInfo);

  const actionList = document.createElement("ol");
  actionList.style.margin = "0";
  actionList.style.paddingLeft = "22px";
  actionList.style.border = "1px solid #ddd";
  actionList.style.borderRadius = "8px";
  actionList.style.paddingTop = "8px";
  actionList.style.paddingBottom = "8px";
  actionList.style.background = "#fafafa";
  sideCol.appendChild(actionList);

  const buttonsRow = document.createElement("div");
  buttonsRow.style.display = "flex";
  buttonsRow.style.gap = "8px";
  buttonsRow.style.marginTop = "8px";

  const clearSelBtn = document.createElement("button");
  clearSelBtn.textContent = "選択解除";
  clearSelBtn.addEventListener("click", () => {
    state.selectedFrom = null;
    state.selectedTo = null;
    render();
  });

  const clearActionsBtn = document.createElement("button");
  clearActionsBtn.textContent = "行動キュー全消し";
  clearActionsBtn.addEventListener("click", () => {
    state.pendingActions = [];
    render();
  });

  buttonsRow.appendChild(clearSelBtn);
  buttonsRow.appendChild(clearActionsBtn);
  sideCol.appendChild(buttonsRow);

  wrap.appendChild(mapCol);
  wrap.appendChild(sideCol);
  rootEl.appendChild(wrap);

  // 都県のボタン配置（%指定でレスポンシブにする）
  // ※位置は“だいたい”です。後で微調整してください。
  const PREFS = [
    { id: "gunma",    label: "群馬",    x: 28, y: 24 },
    { id: "tochigi",  label: "栃木",    x: 52, y: 20 },
    { id: "ibaraki",  label: "茨城",    x: 76, y: 28 },
    { id: "saitama",  label: "埼玉",    x: 46, y: 38 },
    { id: "tokyo",    label: "東京",    x: 50, y: 52 },
    { id: "chiba",    label: "千葉",    x: 72, y: 56 },
    { id: "kanagawa", label: "神奈川",  x: 44, y: 66 },
    { id: "yamanashi",label: "山梨",    x: 24, y: 56 },
  ];

  const prefButtons = new Map();

  for (const p of PREFS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = p.label;

    btn.style.position = "absolute";
    btn.style.left = `${p.x}%`;
    btn.style.top = `${p.y}%`;
    btn.style.transform = "translate(-50%, -50%)";
    btn.style.padding = "6px 10px";
    btn.style.borderRadius = "999px";
    btn.style.border = "1px solid #333";
    btn.style.background = "rgba(255,255,255,0.9)";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "12px";

    btn.addEventListener("click", () => onPickPref(p.id));

    overlay.appendChild(btn);
    prefButtons.set(p.id, btn);
  }

  function onPickPref(prefId) {
    // 1回目：from、2回目：to、3回目以降：fromを更新
    if (!state.selectedFrom) {
      state.selectedFrom = prefId;
      state.selectedTo = null;
      render();
      return;
    }
    if (!state.selectedTo) {
      state.selectedTo = prefId;

      // from と to が同じなら無効
      if (state.selectedFrom === state.selectedTo) {
        state.selectedTo = null;
        render();
        return;
      }

      // 隣接チェック（state.country_adjacency があれば使う）
      const adjacency = getAdjacencyFromGameState(state.gameDoc?.state);
      if (adjacency) {
        const neigh = adjacency[state.selectedFrom] || [];
        if (!neigh.includes(state.selectedTo)) {
          alert("隣接していないため攻撃できません（adjacency 기준）");
          state.selectedTo = null;
          render();
          return;
        }
      }

      // 攻撃アクションをキューに積む（※ここは後でサーバー形式に合わせて調整）
      state.pendingActions.push({
        type: "attack",
        from: state.selectedFrom,
        to: state.selectedTo,
      });

      // 次の入力のため、from を to にスライドさせる（好み）
      state.selectedFrom = state.selectedTo;
      state.selectedTo = null;

      render();
      return;
    }

    state.selectedFrom = prefId;
    state.selectedTo = null;
    render();
  }

  function getAdjacencyFromGameState(gs) {
    if (!gs || typeof gs !== "object") return null;
    // 例: { country_adjacency: { tokyo:[...], ... } }
    if (gs.country_adjacency && typeof gs.country_adjacency === "object") {
      return gs.country_adjacency;
    }
    // 他のキー名にも備える
    if (gs.adjacency && typeof gs.adjacency === "object") {
      return gs.adjacency;
    }
    return null;
  }

  function renderContext() {
    const { gameId, myPlayerIndex } = state.context;
    ctxInfo.innerHTML = "";
    const p1 = document.createElement("div");
    p1.textContent = `gameId: ${gameId ?? "(未設定)"}`;
    const p2 = document.createElement("div");
    p2.textContent = `myPlayerIndex: ${myPlayerIndex ?? "(未設定)"}`;
    ctxInfo.appendChild(p1);
    ctxInfo.appendChild(p2);
  }

  function renderSelection() {
    const from = state.selectedFrom ?? "-";
    const to = state.selectedTo ?? "-";
    selInfo.innerHTML = "";
    const a = document.createElement("div");
    a.textContent = `from: ${from}`;
    const b = document.createElement("div");
    b.textContent = `to: ${to}`;
    const c = document.createElement("div");
    c.style.marginTop = "6px";
    c.style.fontSize = "0.85em";
    c.textContent = "操作: 都県をクリック → from → to の順で攻撃がキューに積まれます。";
    selInfo.appendChild(a);
    selInfo.appendChild(b);
    selInfo.appendChild(c);
  }

  function renderActionList() {
    actionList.innerHTML = "";
    if (state.pendingActions.length === 0) {
      const li = document.createElement("li");
      li.textContent = "(まだ行動がありません)";
      actionList.appendChild(li);
      return;
    }

    state.pendingActions.forEach((ac, idx) => {
      const li = document.createElement("li");
      li.style.marginBottom = "6px";

      const text = document.createElement("span");
      text.textContent = `${idx + 1}. ${ac.type} ${ac.from} → ${ac.to}`;

      const delBtn = document.createElement("button");
      delBtn.textContent = "削除";
      delBtn.style.marginLeft = "8px";
      delBtn.addEventListener("click", () => {
        state.pendingActions.splice(idx, 1);
        render();
      });

      li.appendChild(text);
      li.appendChild(delBtn);
      actionList.appendChild(li);
    });
  }

  function renderPrefButtonStyles() {
    for (const [id, btn] of prefButtons.entries()) {
      const isFrom = state.selectedFrom === id;
      const isTo = state.selectedTo === id;

      btn.style.outline = "none";
      btn.style.boxShadow = "none";

      if (isFrom) {
        btn.style.borderWidth = "3px";
      } else {
        btn.style.borderWidth = "1px";
      }

      if (isTo) {
        btn.style.boxShadow = "0 0 0 3px rgba(0,0,0,0.25)";
      }
    }
  }

  function render() {
    renderContext();
    renderSelection();
    renderActionList();
    renderPrefButtonStyles();
  }

  // 公開API
  function setContext({ gameId, myPlayerIndex }) {
    state.context.gameId = gameId ?? null;
    state.context.myPlayerIndex = (myPlayerIndex == null) ? null : myPlayerIndex;
    render();
  }

  function setGameDoc(gameDoc) {
    state.gameDoc = gameDoc ?? null;
    render();
  }

  function getActionsForSubmit() {
    // ★ 重要：Cloud Functions が期待する Action 形式に合わせる場所
    // いまは最小で {type, from, to} を返しています。
    return [...state.pendingActions];
  }

  function clearPendingActions() {
    state.pendingActions = [];
    render();
  }

  function reset() {
    state.context.gameId = null;
    state.context.myPlayerIndex = null;
    state.gameDoc = null;
    state.selectedFrom = null;
    state.selectedTo = null;
    state.pendingActions = [];
    render();
  }

  render();

  return {
    setContext,
    setGameDoc,
    getActionsForSubmit,
    clearPendingActions,
    reset,
  };
}
