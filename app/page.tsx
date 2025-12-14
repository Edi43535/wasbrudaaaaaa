"use client";

import { useEffect, useRef, useState } from "react";
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
  onChildAdded,
  onChildRemoved,
  off,
  remove,
  get,
} from "firebase/database";

import { auth } from "./config/firebase";

type Message = {
  id: string;
  text: string;
  owner: string;
  timestamp: number;
};

const PAGE_SIZE = 50;

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");

  const [oldestTimestamp, setOldestTimestamp] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  /* 🕒 LIVE-UHR */
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* 🔐 Auth */
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  /* 💬 Initiale + Realtime-Nachrichten */
  useEffect(() => {
    if (!user) return;

    const db = getDatabase(auth.app);
    const q = query(
      ref(db, "messages"),
      orderByChild("timestamp"),
      limitToLast(PAGE_SIZE)
    );

    setMessages([]);
    setOldestTimestamp(null);

    onChildAdded(q, (snap) => {
      const msg = { id: snap.key!, ...snap.val() };
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
      setOldestTimestamp((prev) =>
        prev === null ? msg.timestamp : Math.min(prev, msg.timestamp)
      );
    });

    onChildRemoved(q, (snap) => {
      setMessages((prev) => prev.filter((m) => m.id !== snap.key));
    });

    return () => off(q);
  }, [user]);

  /* 🔽 Pagination */
  async function loadMore() {
    if (!user || loadingMore || oldestTimestamp === null) return;

    setLoadingMore(true);

    const db = getDatabase(auth.app);
    const q = query(
      ref(db, "messages"),
      orderByChild("timestamp"),
      endAt(oldestTimestamp - 1),
      limitToLast(PAGE_SIZE)
    );

    const snap = await get(q);

    const older: Message[] = [];
    snap.forEach((child) => {
      const val = child.val();
      older.push({
        id: child.key!,
        text: val.text,
        owner: val.owner,
        timestamp: val.timestamp,
      });
    });

    older.sort((a, b) => a.timestamp - b.timestamp);

    if (older.length > 0) {
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !existing.has(m.id)), ...prev];
      });
      setOldestTimestamp(older[0].timestamp);
    }

    setLoadingMore(false);
  }

  /* 🔁 Infinite Scroll */
  useEffect(() => {
    if (!bottomRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(loadMore, 300);
      }
    });

    observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [oldestTimestamp]);

  /* 🔐 Auth */
  async function handleLogin() {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function handleRegister() {
    await createUserWithEmailAndPassword(auth, email, password);
  }

  async function handleLogout() {
    await signOut(auth);
  }

  async function handlePasswordReset() {
    if (!user?.email) return;
    await sendPasswordResetEmail(auth, user.email);
    alert("Passwort-Reset-Mail gesendet");
  }

  /* ✍️ Nachricht senden */
  async function pushMessage() {
    if (!message.trim()) return;

    if (!user?.email || !user.email.endsWith("@hs-rm.de")) {
      alert("Nur Nutzer mit @hs-rm.de dürfen Nachrichten senden.");
      return;
    }

    const db = getDatabase(auth.app);
    await push(ref(db, "messages"), {
      text: message,
      owner: user.uid,
      timestamp: Date.now(),
    });

    setMessage("");
  }

  async function deleteMessage(id: string) {
    const db = getDatabase(auth.app);
    await remove(ref(db, `messages/${id}`));
  }

  /* 🔐 LOGIN */
  if (!user) {
    return (
      <div style={loginWrapper}>
        <div style={uniHeader}>Hochschule RheinMain</div>

        <div style={loginContent}>
          <h1 style={submissionTitle}>
            Abgabe Maschinelles Lernen<br />
            von Edvin Jashari
          </h1>

          <div style={loginCard}>
            <h2>💬 Campus Chat</h2>
            <p style={{ color: "#666" }}>Login nur mit @hs-rm.de</p>

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

            <button style={primaryBtn} onClick={handleLogin}>
              Login
            </button>
            <button style={secondaryBtn} onClick={handleRegister}>
              Registrieren
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* 💬 CHAT */
  return (
    <div style={appWrapper}>
      <div style={chatContainer}>
        {/* 🕒 LIVE-UHR */}
        <div style={clockBar}>
          {now.toLocaleDateString("de-DE", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}{" "}
          – {now.toLocaleTimeString("de-DE")}
        </div>

        <div style={chatHeader}>
          <button style={headerBtn} onClick={handleLogout}>Logout</button>
          <button style={headerBtn} onClick={handlePasswordReset}>
            Passwort zurücksetzen
          </button>
        </div>

        <div style={chatNotice}>
          💬 Bitte bleibt freundlich und respektvoll 💙
        </div>

        <div style={messagesBox}>
          {[...messages]
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((m) => {
              const isOwn = m.owner === user.uid;
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: isOwn ? "flex-end" : "flex-start",
                    background: isOwn ? "#bfdbfe" : "#e5e7eb",
                    padding: "10px 14px",
                    borderRadius: 14,
                    marginBottom: 8,
                    maxWidth: "75%",
                  }}
                >
                  {m.text}
                  {isOwn && (
                    <div style={{ textAlign: "right" }}>
                      <button
                        style={deleteBtn}
                        onClick={() => deleteMessage(m.id)}
                      >
                        Löschen
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          <div ref={bottomRef} />
        </div>

        <div style={inputBar}>
          <textarea
            style={chatInput}
            placeholder="Nachricht schreiben…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button style={sendBtn} onClick={pushMessage}>
            Senden
          </button>
        </div>
      </div>
    </div>
  );
}

/* 🎨 STYLES – NUR ERGÄNZT */

const clockBar = {
  textAlign: "center" as const,
  padding: "10px 12px",
  fontSize: 14,
  fontWeight: 600,
  background: "rgba(0,0,0,0.04)",
  borderBottom: "1px solid #e5e7eb",
};

const chatNotice = {
  textAlign: "center" as const,
  padding: "8px 12px",
  fontSize: 14,
  fontWeight: 500,
  color: "#7c2d12",
  background: "rgba(254, 215, 170, 0.6)",
  borderBottom: "1px solid #fed7aa",
};

/* ⬇️ ALLES DARUNTER UNVERÄNDERT */

const loginWrapper = {
  minHeight: "100vh",
  background: "linear-gradient(135deg,#2563eb,#60a5fa)",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
};

const uniHeader = {
  marginTop: 30,
  fontSize: 22,
  fontWeight: 600,
  color: "#fff",
};

const loginContent = {
  marginTop: 40,
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
};

const submissionTitle = {
  color: "#fff",
  textAlign: "center" as const,
  marginBottom: 30,
  fontSize: 28,
  fontWeight: 700,
};

const loginCard = {
  width: 380,
  padding: 30,
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
  textAlign: "center" as const,
};

const appWrapper = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "linear-gradient(135deg,#7f1d1d,#dc2626)",
};

const chatContainer = {
  width: "100%",
  maxWidth: 700,
  height: "85vh",
  background: "#fff",
  borderRadius: 18,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
  display: "flex",
  flexDirection: "column" as const,
};

const chatHeader = {
  padding: 12,
  borderBottom: "1px solid #e5e7eb",
  textAlign: "right" as const,
};

const messagesBox = {
  flex: 1,
  padding: 14,
  overflowY: "auto" as const,
  display: "flex",
  flexDirection: "column" as const,
  background: "#f8fafc",
};

const inputBar = {
  display: "flex",
  gap: 10,
  padding: 12,
  borderTop: "1px solid #e5e7eb",
};

const input = {
  width: "100%",
  padding: 12,
  marginBottom: 12,
  borderRadius: 10,
  border: "1px solid #ccc",
};

const chatInput = {
  flex: 1,
  minHeight: 60,
  resize: "none" as const,
  borderRadius: 10,
  padding: 10,
  border: "1px solid #ccc",
};

const primaryBtn = {
  width: "100%",
  padding: 12,
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  marginBottom: 10,
};

const secondaryBtn = {
  ...primaryBtn,
  background: "#e5e7eb",
  color: "#000",
};

const sendBtn = {
  padding: "0 18px",
  background: "#2563eb",
  color: "#fff",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
};

const headerBtn = {
  marginLeft: 8,
  padding: "6px 10px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
};

const deleteBtn = {
  fontSize: 12,
  marginTop: 4,
  background: "transparent",
  border: "none",
  color: "#1d4ed8",
  cursor: "pointer",
};
