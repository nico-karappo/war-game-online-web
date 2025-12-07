// src/matching.js

// Firebase SDK (モジュール版) を CDN から読み込み
import {
  initializeApp,
  getApp,
  getApps,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
  getFirestore,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  where,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ======================================================
// Firebase プロジェクト設定（index.html と同じ）
const firebaseConfig = {
  apiKey: "AIzaSyDllHnBnkhRFYFeDJtAQmVjMOLwUv5gSyE",
  authDomain: "war-game-online-77a9a.firebaseapp.com",
  projectId: "war-game-online-77a9a",
  storageBucket: "war-game-online-77a9a.firebasestorage.app",
  messagingSenderId: "851982602094",
  appId: "1:851982602094:web:906903954159882bbbfb7f",
  measurementId: "G-GYW85JHDGQ",
};

// すでに別モジュールで initializeApp 済みならそれを再利用し、
// なければここで初期化する。
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
// ======================================================

/**
 * 待機列に入る
 * @param {{ uid: string, displayName: string }} user
 */
export async function joinMatchQueue(user) {
  const waitingRef = doc(db, "matching", "waitingRoom");

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(waitingRef);
    const data = snap.exists()
      ? snap.data()
      : {
          players: [],
        };

    const players = Array.isArray(data.players) ? [...data.players] : [];

    // すでに同じ uid が入っていたら何もしない
    if (players.some((p) => p.uid === user.uid)) {
      return;
    }

    players.push({
      uid: user.uid,
      name: user.displayName || "NoName",
      joinedAt: serverTimestamp(), // サーバー時刻
    });

    tx.set(
      waitingRef,
      {
        players,
      },
      { merge: true }
    );
  });
}

/**
 * 待機列の状態を購読して UI を更新する
 * 例: 待機人数や先頭プレイヤー名をロビー画面に表示
 *
 * @param {(data: any) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeWaitingRoom(callback) {
  const waitingRef = doc(db, "matching", "waitingRoom");
  return onSnapshot(waitingRef, (snap) => {
    if (!snap.exists()) {
      callback({ players: [] });
      return;
    }
    callback(snap.data());
  });
}

/**
 * 自分が参加している最新のゲームを購読する
 * → Cloud Functions 側で games ドキュメントが作られたらコールバックで通知
 *
 * @param {string} uid
 * @param {(game: any | null) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeMyGame(uid, callback) {
  if (!uid) {
    callback(null);
    return () => {};
  }

  const gamesRef = collection(db, "games");

  const q = query(
    gamesRef,
    where("playerIds", "array-contains", uid),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback(null);
      return;
    }
    const docSnap = snap.docs[0];
    callback({ id: docSnap.id, ...docSnap.data() });
  });
}
