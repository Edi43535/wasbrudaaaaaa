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

  // 🔄 Auth-Status
  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 🔄 Initiale 50 Nachrichten (sortiert in DB)
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

  // 🔄 Weitere Nachrichten laden (Infinite Scroll)
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

  // 👀 Debounced Infinite Scroll
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

  // ⬆️ Nachricht senden
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

  // 🗑️ Eigene Nachricht löschen
  async function deleteMessage(id: string) {
    const db = getDatabase(auth.app);
    await remove(ref(db, `messages/${id}`));
  }

  // ❌ Login-Seite
  if (!user) {
    return (
      <div style={{ textAlign: "center", marginTop: 60 }}>
        <h1>Login</h1>

        <input placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <br /><br />
        <input type="password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} />
        <br /><br />

        <button onClick={handleLogin}>Login</button>
        <button onClick={handleRegister} style={{ marginLeft: 10 }}>
          Register
        </button>
      </div>
    );
  }

  // ✅ Chat
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ textAlign: "right", padding: 10 }}>
        <button onClick={handleLogout}>Logout</button>
        <button onClick={handlePasswordReset} style={{ marginLeft: 10 }}>
          Passwort zurücksetzen
        </button>
      </div>

      <div style={{ flex: 8, overflowY: "auto", padding: 10 }}>
        {messages.map((m) => {
          const isOwn = m.owner === user.uid;

          return (
            <div
              key={m.id}
              style={{
                marginBottom: 8,
                padding: "8px 12px",
                borderRadius: 10,
                maxWidth: "70%",
                background: isOwn ? "#dbeafe" : "#f1f5f9",
                alignSelf: isOwn ? "flex-end" : "flex-start",
              }}
            >
              <strong>{isOwn ? "Ich" : "User"}:</strong> {m.text}

              {isOwn && (
                <div style={{ textAlign: "right" }}>
                  <button onClick={() => deleteMessage(m.id)} style={{ fontSize: 12 }}>
                    Löschen
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ flex: 2, display: "flex", gap: 10, padding: 10 }}>
        <input style={{ flex: 1 }} value={message} onChange={(e) => setMessage(e.target.value)} />
        <button onClick={pushMessage}>Upload</button>
      </div>
    </div>
  );
}
