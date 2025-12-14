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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");

  const [oldestTimestamp, setOldestTimestamp] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // 🔄 Auth
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // 🔄 Initial Load
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
      setMessages((prev) => [...prev, msg]);
      setOldestTimestamp((prev) =>
        prev === null ? msg.timestamp : Math.min(prev, msg.timestamp)
      );
    });

    return () => off(q);
  }, [user]);

  // 🔄 Infinite Scroll
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

  // 👀 Debounce Scroll
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

  // 🔐 Auth
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

  // ⬆️ Message
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

  // ❌ LOGIN VIEW
  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg,#2563eb,#60a5fa)",
        }}
      >
        <div
          style={{
            width: 380,
            padding: 30,
            borderRadius: 16,
            background: "#fff",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            textAlign: "center",
          }}
        >
          <h1 style={{ marginBottom: 10 }}>💬 Campus Chat</h1>
          <p style={{ color: "#555", marginBottom: 20 }}>
            Login nur mit Hochschul-Mail
          </p>

          <input
            style={inputStyle}
            type="email"
            placeholder="E-Mail (nur @hs-rm.de)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            style={inputStyle}
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
    );
  }

  // ✅ CHAT VIEW
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 10, textAlign: "right", background: "#2563eb" }}>
        <button style={headerBtn} onClick={handleLogout}>Logout</button>
        <button style={headerBtn} onClick={handlePasswordReset}>
          Passwort zurücksetzen
        </button>
      </div>

      <div
        style={{
          flex: 8,
          overflowY: "auto",
          padding: 15,
          display: "flex",
          flexDirection: "column",
          background: "#f8fafc",
        }}
      >
        {messages.map((m) => {
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
                maxWidth: "70%",
              }}
            >
              <div>{m.text}</div>
              {isOwn && (
                <button
                  style={{ fontSize: 12, marginTop: 4 }}
                  onClick={() => deleteMessage(m.id)}
                >
                  Löschen
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: 10, display: "flex", gap: 10 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Nachricht schreiben..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button style={primaryBtn} onClick={pushMessage}>
          Senden
        </button>
      </div>
    </div>
  );
}

/* 🎨 Styles */
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginBottom: 12,
  borderRadius: 10,
  border: "1px solid #ccc",
  fontSize: 15,
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: 12,
  background: "#2563eb",
  color: "#fff",
  borderRadius: 10,
  border: "none",
  fontSize: 16,
  marginBottom: 10,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  ...primaryBtn,
  background: "#e5e7eb",
  color: "#000",
};

const headerBtn: React.CSSProperties = {
  marginLeft: 10,
  padding: "6px 10px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
};
