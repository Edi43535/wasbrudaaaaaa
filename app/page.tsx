"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  User,
} from "firebase/auth";

import {
  getDatabase,
  ref,
  push,
  query,
  orderByChild,
  limitToLast,
  endAt,
  startAt,
  onChildAdded,
  remove,
  get,
} from "firebase/database";

import { auth } from "./config/firebase";

/* ================= TYPES ================= */

type Message = {
  id: string;
  text: string;
  owner: string;
  timestamp: number;
};

const PAGE_SIZE = 50;

/* ================= COMPONENT ================= */

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");

  const [oldestTimestamp, setOldestTimestamp] = useState<number | null>(null);
  const [latestTimestamp, setLatestTimestamp] = useState<number | null>(null);

  const [loadingMore, setLoadingMore] = useState(false);
  const [busyAuth, setBusyAuth] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  // ✅ FIX: browser-safe Timeout-Typ (Vercel-Crash behoben)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ================= AUTH ================= */

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  /* ================= INITIAL + REALTIME LOAD ================= */

  useEffect(() => {
    if (!user) return;

    const db = getDatabase(auth.app);
    const baseRef = ref(db, "messages");

    let cancelled = false;
    let unsubscribeNew: (() => void) | null = null;

    async function loadInitial() {
      setMessages([]);
      setOldestTimestamp(null);
      setLatestTimestamp(null);

      try {
        // 🔹 Initiale 50 (einmalig, schnell)
        const qInit = query(baseRef, orderByChild("timestamp"), limitToLast(PAGE_SIZE));
        const snap = await get(qInit);
        if (cancelled) return;

        const list: Message[] = [];
        snap.forEach((c) => {
          const v = c.val();
          list.push({
            id: c.key!,
            text: v.text,
            owner: v.owner,
            timestamp: v.timestamp,
          });
        });

        list.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(list);

        if (list.length > 0) {
          const oldest = list[0].timestamp;
          const latest = list[list.length - 1].timestamp;
          setOldestTimestamp(oldest);
          setLatestTimestamp(latest);

          // 🔹 Realtime: nur NEUE Nachrichten
          const qNew = query(baseRef, orderByChild("timestamp"), startAt(latest + 1));
          unsubscribeNew = onChildAdded(qNew, (snapNew) => {
            const v = snapNew.val();
            const msg: Message = {
              id: snapNew.key!,
              text: v.text,
              owner: v.owner,
              timestamp: v.timestamp,
            };
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
            );
            setLatestTimestamp((p) =>
              p === null ? msg.timestamp : Math.max(p, msg.timestamp)
            );
          });
        }
      } catch {
        setError("Nachrichten konnten nicht geladen werden.");
      }
    }

    loadInitial();

    return () => {
      cancelled = true;
      if (unsubscribeNew) unsubscribeNew();
    };
  }, [user]);

  /* ================= LOAD OLDER ================= */

  async function loadMore() {
    if (!user || loadingMore || oldestTimestamp === null) return;

    setLoadingMore(true);

    try {
      const db = getDatabase(auth.app);
      const baseRef = ref(db, "messages");

      const qMore = query(
        baseRef,
        orderByChild("timestamp"),
        endAt(oldestTimestamp - 1),
        limitToLast(PAGE_SIZE)
      );

      const snap = await get(qMore);
      const older: Message[] = [];

      snap.forEach((c) => {
        const v = c.val();
        older.push({
          id: c.key!,
          text: v.text,
          owner: v.owner,
          timestamp: v.timestamp,
        });
      });

      older.sort((a, b) => a.timestamp - b.timestamp);

      if (older.length > 0) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          return [...older.filter((m) => !ids.has(m.id)), ...prev];
        });
        setOldestTimestamp(older[0].timestamp);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  /* ================= INFINITE SCROLL ================= */

  useEffect(() => {
    if (!bottomRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(loadMore, 200);
      }
    });

    observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [oldestTimestamp, user, loadingMore]);

  /* ================= ACTIONS ================= */

  async function handleLogin() {
    setBusyAuth(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("Login fehlgeschlagen: E-Mail oder Passwort falsch.");
    } finally {
      setBusyAuth(false);
    }
  }

  async function handleRegister() {
    setBusyAuth(true);
    setError("");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch {
      setError("Registrierung fehlgeschlagen.");
    } finally {
      setBusyAuth(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  async function handlePasswordReset() {
    if (!user?.email) return;
    await sendPasswordResetEmail(auth, user.email);
    alert("Passwort-Reset-Mail gesendet");
  }

  async function pushMessage() {
    if (!message.trim()) return;

    const db = getDatabase(auth.app);
    await push(ref(db, "messages"), {
      text: message,
      owner: user!.uid,
      timestamp: Date.now(),
    });

    setMessage("");
  }

  async function deleteMessage(id: string) {
    const db = getDatabase(auth.app);
    await remove(ref(db, `messages/${id}`));
  }

  /* ================= RENDER ================= */

  if (authLoading) {
    return <div style={center}>Lade Anwendung…</div>;
  }

  if (!user) {
    return (
      <div style={loginPage}>
        <h1>Hochschule RheinMain</h1>
        <h2>Abgabe Maschinelles Lernen</h2>
        <p>von Edvin Jashari</p>

        <div style={card}>
          {error && <div style={errorBox}>{error}</div>}

          <input
            style={input}
            placeholder="E-Mail (nur @hs-rm.de)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            style={input}
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button style={btnPrimary} disabled={busyAuth} onClick={handleLogin}>
            Login
          </button>
          <button style={btnOutline} disabled={busyAuth} onClick={handleRegister}>
            Registrieren
          </button>
        </div>
      </div>
    );
  }

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.timestamp - b.timestamp),
    [messages]
  );

  return (
    <div style={chatPage}>
      <div style={chatBox}>
        <div style={chatHeader}>
          <button style={btnOutline} onClick={handlePasswordReset}>
            Passwort zurücksetzen
          </button>
          <button style={btnDanger} onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div style={chatBody}>
          {sortedMessages.map((m) => {
            const isOwn = m.owner === user.uid;
            return (
              <div key={m.id} style={isOwn ? bubbleOwn : bubbleOther}>
                {m.text}
                {isOwn && (
                  <button style={deleteBtn} onClick={() => deleteMessage(m.id)}>
                    Löschen
                  </button>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div style={composer}>
          <textarea
            style={textarea}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Nachricht schreiben…"
          />
          <button style={btnPrimary} onClick={pushMessage}>
            Senden
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const center = { height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" };

const loginPage = {
  minHeight: "100vh",
  background: "linear-gradient(135deg,#2563eb,#60a5fa)",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
};

const card = {
  background: "#fff",
  color: "#000",
  padding: 24,
  borderRadius: 16,
  width: 360,
};

const input = { width: "100%", padding: 12, marginBottom: 12 };
const btnPrimary = { width: "100%", padding: 12, background: "#2563eb", color: "#fff" };
const btnOutline = { width: "100%", padding: 12, marginTop: 8, border: "1px solid #2563eb" };
const btnDanger = { padding: 8, border: "1px solid red", color: "red" };

const errorBox = { background: "#fee2e2", padding: 10, marginBottom: 10 };

const chatPage = { minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" };
const chatBox = { width: 700, height: "85vh", background: "#fff", display: "flex", flexDirection: "column" as const };
const chatHeader = { padding: 10, display: "flex", justifyContent: "space-between" as const };
const chatBody = { flex: 1, padding: 10, overflowY: "auto" as const };
const composer = { padding: 10, display: "flex", gap: 8 };
const textarea = { flex: 1, minHeight: 60 };

const bubbleOwn = { alignSelf: "flex-end", background: "#bfdbfe", padding: 10, borderRadius: 12 };
const bubbleOther = { alignSelf: "flex-start", background: "#e5e7eb", padding: 10, borderRadius: 12 };
const deleteBtn = { display: "block", fontSize: 12 };
