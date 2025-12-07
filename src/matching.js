// src/matching.js

// Firebase v12 (CDN)
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
  collection,
  query,
  limit,
  where,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";

// ==== Firebase プロジェクト設定（index.html と同じ） ====
const firebaseConfig = {
  apiKey: "AIzaSyDllHnBnkhRFYFeDJtAQmVjMOLwUv5gSyE",
  authDomain: "war-game-online-77a9a.firebaseapp.com",
  projectId: "war-game-online-77a9a",
  storageBucket: "war-game-online-77a9a.firebasestorage.app",
  messagingSenderId: "851982602094",
  appId: "1:851982602094:web:906903954159882bbbfb7f",
  measurementId: "G-GYW85JHDGQ",
};

// すでに別モジュールで initialize 済みなら再利用
let app;
if (getApps().length) {
  app = getApp();
} else {
  app = initializeApp(firebaseConfig);
}

const db = getFirestore(app);
const functions = getFunctions(app, "us-central1");

// Cloud Functions ラッパー
const submitTurnFn = httpsCallable(functions, "submitTurn");
const forceLobbyMatchFn = httpsCallable(functions, "forceLobbyMatch");

/**
 * 待機列に入る（ロビーに参加）
 * @param {{ uid: string, displayName: string }} user
 */
export async function joinMatchQueue(user) {
  const waitingRef = doc(db, "matching", "waitingRoom");

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(waitingRef);
    const data = snap.exists() ? snap.data() : { players: [] };

    const players = Array.isArray(data.players) ? [...data.players] : [];

    // すでに同じ uid が入っていたら何もしない
    if (players.some((p) => p.uid === user.uid)) {
      return;
    }

    players.push({
      uid: user.uid,
      name: user.displayName || "NoName",
      // serverTimestamp() は配列内で使えないのでクライアント時刻(ms)で代用
      joinedAt: Date.now(),
    });

    tx.set(
      waitingRef,
      { players },
      { merge: true },
    );
  });
}

/**
 * 待機列の状態を購読して UI を更新する
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
 *
 * @param {string} uid
 * @param {(game: {id: string, [key: string]: any} | null) => void} callback
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
    limit(1),
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

/**
 * 自分が参加している最新のゲームを購読する
 *
 * @param {string} uid
 * @param {(game: {id: string, [key: string]: any} | null) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeMyGame(uid, callback) {
  if (!uid) {
    callback(null);
    return () => {};
  }

  const gamesRef = collection(db, "games");

  // ★ orderBy を使わず、playerIds に自分の uid を含むゲームを1件だけ見る
  const q = query(
    gamesRef,
    where("playerIds", "array-contains", uid),
    limit(1)
  );

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        console.log("subscribeMyGame: no game found for uid =", uid);
        callback(null);
        return;
      }
      const docSnap = snap.docs[0];
      const gameData = { id: docSnap.id, ...docSnap.data() };
      console.log("subscribeMyGame: game found =", gameData.id);
      callback(gameData);
    },
    (error) => {
      console.error("subscribeMyGame error:", error);
      callback(null);
    }
  );
}


/**
 * Cloud Functions submitTurn を呼び出す
 *
 * @param {string} gameId
 * @param {number} playerIndex
 * @param {any[]} actions
 * @returns {Promise<any>} res.data（currentTurn など）
 */
export async function submitTurn(gameId, playerIndex, actions) {
  const res = await submitTurnFn({
    gameId,
    playerIndex,
    actions: Array.isArray(actions) ? actions : [],
  });
  return res.data;
}

/**
 * 3分経過時などに、ロビー内プレイヤーでマッチングを実行させる
 */
export async function callForceLobbyMatch() {
  try {
    await forceLobbyMatchFn();
    console.log("forceLobbyMatch called.");
  } catch (err) {
    console.error("forceLobbyMatch error:", err);
  }
}
