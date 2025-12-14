// war-game-online-web/src/war_game/kanto/KantoMapCanvas.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

// GitHub Pages 配下でも壊れにくい assets URL を作る
function assetUrl(path) {
  // Vite 系
  const viteBase =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      typeof import.meta.env.BASE_URL === "string" &&
      import.meta.env.BASE_URL) ||
    "";

  // CRA 系
  const craBase =
    (typeof process !== "undefined" &&
      process.env &&
      typeof process.env.PUBLIC_URL === "string" &&
      process.env.PUBLIC_URL) ||
    "";

  // base が取れるならそれを優先。取れなければ相対基準で。
  const base = viteBase || craBase || "./";
  const normalizedBase = base.endsWith("/") ? base : base + "/";
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return normalizedBase + normalizedPath;
}

export default function KantoMapCanvas({
  width = 794,
  height = 898,
  onLoaded,
  // ここにあなたの既存 props（クリック処理、選択状態など）があればそのまま追加
}) {
  const canvasRef = useRef(null);
  const [imgReady, setImgReady] = useState(false);

  // ★ public/assets/kanto.png を参照（今の配置に合わせる）
  const mapImageUrl = useMemo(() => assetUrl("public/assets/kanto.png"), []);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      setImgReady(true);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (typeof onLoaded === "function") onLoaded();
    };

    img.onerror = (e) => {
      console.error("Failed to load map image:", mapImageUrl, e);
      setImgReady(false);
    };

    img.src = mapImageUrl;
  }, [mapImageUrl, onLoaded]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          border: "1px solid #ccc",
          display: "block",
          width: `${width}px`,
          height: `${height}px`,
        }}
      />
      {!imgReady ? (
        <div style={{ marginTop: 8, color: "#666" }}>
          地図画像を読み込み中…（{mapImageUrl}）
        </div>
      ) : null}
    </div>
  );
}
