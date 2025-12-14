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

    let unsubscribeNew: null | (() => void) = null;
    let cancelled = false;

    async function initialLoad() {
      setMessages([]);
      setOldestTimestamp(null);
      setLatestTimestamp(null);

      const qInitial = query(baseRef, orderByChild("timestamp"), limitToLast(PAGE_SIZE));
      const snap = await get(qInitial);
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
        const latest = list[list.length - 1].timestamp;
        setOldestTimestamp(list[0].timestamp);
        setLatestTimestamp(latest);

        const qNew = query(baseRef, orderByChild("timestamp"), startAt(latest + 1));
        unsubscribeNew = onChildAdded(qNew, (s) => {
          const v = s.val();
          setMessages((prev) =>
            prev.some((m) => m.id === s.key)
              ? prev
              : [...prev, { id: s.key!, ...v }]
          );
          setLatestTimestamp((p) => Math.max(p ?? 0, v.timestamp));
        });
      }
    }

    initialLoad();

    return () => {
      cancelled = true;
      if (unsubscribeNew) unsubscribeNew();
    };
  }, [user]);

  /* ================= LOAD OLDER ================= */

  async function loadMore() {
    if (!user || loadingMore || oldestTimestamp === null) return;
    setLoadingMore(true);

    const db = getDatabase(auth.app);
    const qMore = query(
      ref(db, "messages"),
      orderByChild("timestamp"),
      endAt(oldestTimestamp - 1),
      limitToLast(PAGE_SIZE)
    );

    const snap = await get(qMore);
    const older: Message[] = [];
    snap.forEach((c) => older.push({ id: c.key!, ...c.val() }));
    older.sort((a, b) => a.timestamp - b.timestamp);

    if (older.length > 0) {
      setMessages((prev) => [...older, ...prev]);
      setOldestTimestamp(older[0].timestamp);
    }
    setLoadingMore(false);
  }

  /* ================= SCROLL ================= */

  useEffect(() => {
    if (!bottomRef.current) return;
    const obs = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(loadMore, 200);
      }
    });
    obs.observe(bottomRef.current);
    return () => obs.disconnect();
  }, [oldestTimestamp]);

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
    return <div className="center">Lade Anwendung…</div>;
  }

  if (!user) {
    return (
      <div className="loginBg">
        <h1>Hochschule RheinMain</h1>
        <h2>Abgabe Maschinelles Lernen</h2>
        <p>von Edvin Jashari</p>

        <div className="card">
          {error && <div className="alert">{error}</div>}
          <input
            className="input"
            placeholder="E-Mail (nur @hs-rm.de)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btnPrimary" onClick={handleLogin} disabled={busyAuth}>
            Login
          </button>
          <button className="btnOutline" onClick={handleRegister} disabled={busyAuth}>
            Registrieren
          </button>
        </div>

        <Styles />
      </div>
    );
  }

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.timestamp - b.timestamp),
    [messages]
  );

  return (
    <div className="chatPage">
      <div className="chatShell">
        <div className="chatTop">
          <div>
            <b>Campus Chat</b>
            <div className="small">Eingeloggt als {user.email}</div>
          </div>
          <div>
            <button className="btnOutline" onClick={handlePasswordReset}>
              Passwort
            </button>
            <button className="btnDanger" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className="chatBody">
          {sortedMessages.map((m) => {
            const own = m.owner === user.uid;
            return (
              <div key={m.id} className={`bubble ${own ? "own" : "other"}`}>
                {m.text}
                {own && (
                  <button className="link" onClick={() => deleteMessage(m.id)}>
                    Löschen
                  </button>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="composer">
          <textarea
            className="textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Nachricht schreiben…"
          />
          <button className="btnPrimary" onClick={pushMessage}>
            Senden
          </button>
        </div>
      </div>

      <Styles />
    </div>
  );
}

/* ================= STYLES ================= */

function Styles() {
  return (
    <style jsx global>{`
      body { margin: 0; font-family: system-ui, sans-serif; }

      .center { height: 100vh; display: flex; align-items: center; justify-content: center; }

      .loginBg {
        min-height: 100vh;
        background: linear-gradient(135deg, #2563eb, #60a5fa);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        gap: 10px;
      }

      .card {
        background: white;
        padding: 24px;
        border-radius: 16px;
        width: 360px;
        color: black;
      }

      .input {
        width: 100%;
        padding: 12px;
        margin-bottom: 10px;
      }

      .btnPrimary {
        width: 100%;
        padding: 12px;
        background: #2563eb;
        color: white;
        border: none;
        margin-top: 6px;
        cursor: pointer;
      }

      .btnOutline {
        width: 100%;
        padding: 12px;
        margin-top: 6px;
        background: white;
        border: 1px solid #2563eb;
        color: #2563eb;
        cursor: pointer;
      }

      .alert {
        background: #fee2e2;
        padding: 10px;
        margin-bottom: 10px;
      }

      /* 🔴 Roter Chat-Hintergrund */
      .chatPage {
        min-height: 100vh;
        background: linear-gradient(135deg, #7f1d1d, #dc2626);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .chatShell {
        width: 700px;
        height: 85vh;
        background: white;
        border-radius: 18px;
        display: flex;
        flex-direction: column;
      }

      .chatTop {
        background: #991b1b;
        color: white;
        padding: 12px;
        display: flex;
        justify-content: space-between;
      }

      .chatBody {
        flex: 1;
        padding: 12px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .bubble {
        max-width: 70%;
        padding: 10px;
        border-radius: 12px;
      }

      .bubble.own {
        align-self: flex-end;
        background: #fecaca;
      }

      .bubble.other {
        align-self: flex-start;
        background: #e5e7eb;
      }

      .link {
        background: none;
        border: none;
        color: #7f1d1d;
        font-size: 12px;
        cursor: pointer;
        margin-top: 4px;
      }

      .composer {
        display: flex;
        gap: 10px;
        padding: 12px;
        border-top: 1px solid #ddd;
      }

      .textarea {
        flex: 1;
        min-height: 60px;
      }

      .small { font-size: 12px; opacity: 0.8; }

      .btnDanger {
        background: #7f1d1d;
        color: white;
        border: none;
        padding: 8px 12px;
        margin-left: 6px;
        cursor: pointer;
      }
    `}</style>
  );
}
