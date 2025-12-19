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

  /* 🔐 Auth Actions */
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
    if (!email) {
      alert("Bitte E-Mail eingeben");
      return;
    }
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
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
        <BackgroundFX />
        <div style={loginContent}>
          <h1 style={submissionTitle}>
            Abgabe Maschinelles Lernen
            <br />
            von Edvin Jashari
          </h1>

          <div style={loginCard}>
            <input
              style={input}
              placeholder="E-Mail"
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
            <button style={secondaryBtn} onClick={handlePasswordReset}>
              Passwort zurücksetzen
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
        <div style={clockBar}>
          {now.toLocaleDateString("de-DE")} –{" "}
          {now.toLocaleTimeString("de-DE")}
        </div>

        <div style={chatHeader}>
          <button style={headerBtn} onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div style={messagesBox}>
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
                  maxWidth: "75%",
                }}
              >
                {m.text}
                {isOwn && (
                  <button
                    style={deleteBtn}
                    onClick={() => deleteMessage(m.id)}
                  >
                    Löschen
                  </button>
                )}
              </div>
            );
          })}

          <div ref={bottomRef}>
            {loadingMore ? "Lade ältere Nachrichten…" : ""}
          </div>
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

/* ---------- STYLES (unverändert) ---------- */

const clockBar = { padding: 10, textAlign: "center" as const };
const loginWrapper = { minHeight: "100vh" };
const loginContent = { textAlign: "center" as const };
const submissionTitle = { fontSize: 26 };
const loginCard = { padding: 20 };
const appWrapper = { minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" };
const chatContainer = { width: 700, height: "85vh", display: "flex", flexDirection: "column" as const };
const chatHeader = { padding: 10, textAlign: "right" as const };
const messagesBox = { flex: 1, overflowY: "auto" as const, padding: 10 };
const inputBar = { display: "flex", gap: 10, padding: 10 };
const input = { width: "100%", padding: 10 };
const chatInput = { flex: 1 };
const primaryBtn = { padding: 10 };
const secondaryBtn = { padding: 10 };
const sendBtn = { padding: "0 20px" };
const headerBtn = { padding: "6px 10px" };
const deleteBtn = { fontSize: 12 };

function BackgroundFX() {
  return null;
}
