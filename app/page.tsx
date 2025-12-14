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
  off,
  remove,
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
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");

  const [oldestTimestamp, setOldestTimestamp] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  /* 🔐 AUTH – sofortiges Feedback */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  /* 🔄 Messages sofort nach Auth */
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

    return () => off(q);
  }, [user]);

  /* 🔄 Infinite Scroll */
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

    onChildAdded(q, (snap) => {
      const msg = { id: snap.key!, ...snap.val() };
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev]
      );
      setOldestTimestamp((prev) =>
        prev === null ? msg.timestamp : Math.min(prev, msg.timestamp)
      );
    });

    setLoadingMore(false);
  }

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
  }, [oldestTimestamp]);

  /* 🔐 Auth Actions */
  const handleLogin = async () =>
    signInWithEmailAndPassword(auth, email, password);

  const handleRegister = async () =>
    createUserWithEmailAndPassword(auth, email, password);

  const handleLogout = async () => signOut(auth);

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    await sendPasswordResetEmail(auth, user.email);
    alert("Passwort-Reset-Mail gesendet");
  };

  /* 💬 Messages */
  const pushMessage = async () => {
    if (!message.trim()) return;

    const db = getDatabase(auth.app);
    await push(ref(db, "messages"), {
      text: message,
      owner: user!.uid,
      timestamp: Date.now(),
    });

    setMessage("");
  };

  const deleteMessage = async (id: string) => {
    const db = getDatabase(auth.app);
    await remove(ref(db, `messages/${id}`));
  };

  /* ⏳ AUTH LOADING SCREEN (wichtig!) */
  if (authLoading) {
    return (
      <div style={loadingScreen}>
        <div style={spinner} />
        <p>Verbinde mit Firebase …</p>
      </div>
    );
  }

  /* 🔐 LOGIN */
  if (!user) {
    return (
      <div style={loginWrapper}>
        <h1 style={{ color: "#fff" }}>Hochschule RheinMain</h1>
        <h2 style={{ color: "#fff", marginBottom: 30 }}>
          Abgabe Maschinelles Lernen<br />von Edvin Jashari
        </h2>

        <div style={loginCard}>
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
          <button style={primaryBtn} onClick={handleLogin}>Login</button>
          <button style={secondaryBtn} onClick={handleRegister}>Registrieren</button>
        </div>
      </div>
    );
  }

  /* 💬 CHAT */
  return (
    <div style={appWrapper}>
      <div style={chatContainer}>
        <div style={chatHeader}>
          <button onClick={handleLogout}>Logout</button>
          <button onClick={handlePasswordReset}>Passwort zurücksetzen</button>
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
                    <button style={deleteBtn} onClick={() => deleteMessage(m.id)}>
                      Löschen
                    </button>
                  )}
                </div>
              );
            })}
          <div ref={bottomRef} />
        </div>

        <div style={inputBar}>
          <textarea
            style={chatInput}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Nachricht schreiben…"
          />
          <button style={sendBtn} onClick={pushMessage}>Senden</button>
        </div>
      </div>
    </div>
  );
}

/* 🎨 STYLES */
const loadingScreen = {
  height: "100vh",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "center",
  alignItems: "center",
};

const spinner = {
  width: 40,
  height: 40,
  border: "4px solid #ddd",
  borderTop: "4px solid #2563eb",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const loginWrapper = {
  minHeight: "100vh",
  background: "linear-gradient(135deg,#2563eb,#60a5fa)",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
};

const loginCard = {
  background: "#fff",
  padding: 30,
  borderRadius: 16,
  width: 380,
};

const appWrapper = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "#f1f5f9",
};

const chatContainer = {
  width: "100%",
  maxWidth: 700,
  height: "85vh",
  background: "#fff",
  borderRadius: 18,
  display: "flex",
  flexDirection: "column" as const,
};

const chatHeader = { padding: 12, textAlign: "right" as const };
const messagesBox = { flex: 1, padding: 14, overflowY: "auto" as const, display: "flex", flexDirection: "column" as const };
const inputBar = { display: "flex", gap: 10, padding: 12 };
const input = { width: "100%", padding: 12, marginBottom: 12 };
const chatInput = { flex: 1, minHeight: 60 };
const primaryBtn = { width: "100%", padding: 12, background: "#2563eb", color: "#fff" };
const secondaryBtn = { ...primaryBtn, background: "#e5e7eb", color: "#000" };
const sendBtn = { padding: "0 18px", background: "#2563eb", color: "#fff" };
const deleteBtn = { fontSize: 12, background: "transparent", border: "none" };
