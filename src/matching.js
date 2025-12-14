// war-game-online-web/src/matching.js
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  runTransaction,
  collection,
  query,
  where,
  limit,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

// ★あなたの Firebase 設定（既存の値を維持してください）
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

const submitTurnFn = httpsCallable(functions, "submitTurn");
const forceLobbyMatchFn = httpsCallable(functions, "forceLobbyMatch");

async function ensureAnonAuth() {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

// 8人ロビー（matching/waitingRoom）に参加
export async function joinMatchQueue(roomId, player) {
  await ensureAnonAuth();

  const roomRef = doc(db, "matching", roomId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    const data = snap.exists() ? snap.data() : {};

    const players = Array.isArray(data.players) ? [...data.players] : [];

    const idx = players.findIndex((p) => p && p.uid === player.uid);
    const record = {
      uid: player.uid,
      name: player.name ?? "",
      joinedAt: Date.now(),
    };

    if (idx >= 0) {
      players[idx] = { ...players[idx], ...record };
    } else {
      players.push(record);
    }

    tx.set(
      roomRef,
      {
        roomId,
        players,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
}

// ロビー待機部屋を監視
export function subscribeWaitingRoom(roomId, callback) {
  const roomRef = doc(db, "matching", roomId);
  return onSnapshot(roomRef, (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

// 自分が所属するゲームを探す（インデックス不要版）
export function subscribeMyGame(uid, callback) {
  const q = query(
    collection(db, "games"),
    where("playerIds", "array-contains", uid),
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

// 特定 gameId のドキュメントを監視
export function subscribeGame(gameId, callback) {
  const gameRef = doc(db, "games", gameId);
  return onSnapshot(gameRef, (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

// submitTurn を呼ぶ
export async function submitTurn(gameId, playerIndex, actions) {
  await ensureAnonAuth();
  const res = await submitTurnFn({ gameId, playerIndex, actions });
  return res.data;
}

// 強制マッチ（3分タイムアウト等で使う）
export async function callForceLobbyMatch(roomId) {
  await ensureAnonAuth();
  const res = await forceLobbyMatchFn({ roomId });
  return res.data;
}
