// war-game-online-web/src/matching.js
// GitHub Pages（素のHTML+ESM）で動く Firebase CDN 版

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  collection,
  query,
  where,
  limit,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyDv1ofylbqvZWJgKSH6sR5f4S_Mhw6A1Y4",
  authDomain: "war-game-online-77a9a.firebaseapp.com",
  projectId: "war-game-online-77a9a",
  storageBucket: "war-game-online-77a9a.appspot.com",
  messagingSenderId: "701785175033",
  appId: "1:701785175033:web:88330ea877e69798736c38",
  measurementId: "G-E7L2NJPG8V",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Functions を us-central1 にデプロイしている前提
const functions = getFunctions(app, "us-central1");

// callable functions
const submitTurnFn = httpsCallable(functions, "submitTurn");
const forceLobbyMatchFn = httpsCallable(functions, "forceLobbyMatch");

// ---- auth（匿名ログイン） ----
// Firestore ルールが request.auth 必須のときでも動くように、匿名ログインを試みます。
// ただし Auth 未有効などで失敗することもあるので、その場合は継続できるようにしています。
let _authReadyPromise = null;

async function ensureAnonAuth() {
  if (auth.currentUser) return auth.currentUser;

  if (!_authReadyPromise) {
    _authReadyPromise = signInAnonymously(auth)
      .then((cred) => cred.user)
      .catch((err) => {
        console.warn("[matching] signInAnonymously failed:", err);
        _authReadyPromise = null;
        throw err;
      });
  }
  return _authReadyPromise;
}

function roomDocRef(roomId) {
  const rid = String(roomId || "waitingRoom");
  return doc(db, "matching", rid);
}

function normalizeArgs_roomId_and_user(args) {
  // joinMatchQueue(user)
  // joinMatchQueue(roomId, user)  ← 互換用
  let roomId = "waitingRoom";
  let user = null;

  if (args.length === 1 && typeof args[0] === "object" && args[0]) {
    user = args[0];
  } else if (
    args.length >= 2 &&
    typeof args[0] === "string" &&
    typeof args[1] === "object" &&
    args[1]
  ) {
    roomId = args[0];
    user = args[1];
  } else {
    throw new Error("joinMatchQueue: invalid arguments");
  }

  const uid = String(user.uid || "").trim();
  const displayName = String(user.displayName || user.name || "").trim();
  if (!uid) throw new Error("joinMatchQueue: user.uid is required");

  return {
    roomId,
    user: {
      uid,
      name: displayName || "NoName",
    },
  };
}

export async function joinMatchQueue(...args) {
  const { roomId, user } = normalizeArgs_roomId_and_user(args);

  // auth 試行（失敗しても続行：公開ルールなら auth 無しでも通るため）
  try {
    await ensureAnonAuth();
  } catch (_) {}

  const ref = roomDocRef(roomId);
  const nowMs = Date.now();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : null;

    const playersRaw = data && Array.isArray(data.players) ? data.players : [];
    const players = playersRaw.filter(
      (p) => p && typeof p.uid === "string" && p.uid !== user.uid
    );

    players.push({
      uid: user.uid,
      name: user.name,
      joinedAt: nowMs, // number でOK（Functions側で解釈可能）
    });

    // joinedAt で古い順
    players.sort((a, b) => {
      const ta = typeof a.joinedAt === "number" ? a.joinedAt : 0;
      const tb = typeof b.joinedAt === "number" ? b.joinedAt : 0;
      return ta - tb;
    });

    tx.set(ref, { players, updatedAt: serverTimestamp() }, { merge: true });
  });

  return { ok: true, roomId };
}

export function subscribeWaitingRoom(...args) {
  // subscribeWaitingRoom(callback)
  // subscribeWaitingRoom(roomId, callback) ← 互換用
  let roomId = "waitingRoom";
  let callback = null;

  if (args.length === 1 && typeof args[0] === "function") {
    callback = args[0];
  } else if (
    args.length >= 2 &&
    typeof args[0] === "string" &&
    typeof args[1] === "function"
  ) {
    roomId = args[0];
    callback = args[1];
  } else {
    throw new Error("subscribeWaitingRoom: invalid arguments");
  }

  const ref = roomDocRef(roomId);

  return onSnapshot(
    ref,
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      const players = Array.isArray(data.players) ? data.players : [];
      callback({
        roomId,
        players,
        updatedAt: data.updatedAt ?? null,
      });
    },
    (err) => {
      console.warn("[matching] subscribeWaitingRoom error:", err);
      callback({ roomId, players: [], error: String(err?.message ?? err) });
    }
  );
}

export function subscribeMyGame(lobbyUid, callback) {
  const uid = String(lobbyUid || "").trim();
  if (!uid) throw new Error("subscribeMyGame: lobbyUid is required");
  if (typeof callback !== "function") throw new Error("subscribeMyGame: callback is required");

  const q = query(collection(db, "games"), where("playerIds", "array-contains", uid), limit(1));
  return onSnapshot(
    q,
    (qs) => {
      if (qs.empty) {
        callback(null);
        return;
      }
      const docSnap = qs.docs[0];
      callback({ id: docSnap.id, ...docSnap.data() });
    },
    (err) => {
      console.warn("[matching] subscribeMyGame error:", err);
      callback(null);
    }
  );
}

export function subscribeGame(gameId, callback) {
  const gid = String(gameId || "").trim();
  if (!gid) throw new Error("subscribeGame: gameId is required");
  if (typeof callback !== "function") throw new Error("subscribeGame: callback is required");

  const ref = doc(db, "games", gid);
  return onSnapshot(
    ref,
    (snap) => {
      callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    },
    (err) => {
      console.warn("[matching] subscribeGame error:", err);
      callback(null);
    }
  );
}

export async function submitTurn(gameId, playerIndex, actions) {
  const gid = String(gameId || "").trim();
  if (!gid) throw new Error("submitTurn: gameId is required");

  const pidx = Number(playerIndex);
  if (!Number.isFinite(pidx)) throw new Error("submitTurn: playerIndex must be number");

  const act = Array.isArray(actions) ? actions : [];

  try {
    await ensureAnonAuth();
  } catch (_) {}

  const res = await submitTurnFn({
    gameId: gid,
    playerIndex: pidx,
    actions: act,
  });
  return res.data;
}

// 互換用（必要なら使ってOK）
export const submitTurnApi = submitTurn;

export async function callForceLobbyMatch(roomId) {
  try {
    await ensureAnonAuth();
  } catch (_) {}

  const res = await forceLobbyMatchFn({ roomId: roomId ?? "waitingRoom" });
  return res.data;
}
