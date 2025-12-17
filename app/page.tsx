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
  onValue,
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

  /* 🔐 AUTH */
  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  /* 💬 REALTIME MESSAGES — onValue (FIXED) */
  useEffect(() => {
    if (!user) return;

    const db = getDatabase(auth.app);
    const q = query(
      ref(db, "messages"),
      orderByChild("timestamp"),
      limitToLast(PAGE_SIZE)
    );

    const unsubscribe = onValue(q, (snapshot) => {
      const loaded: Message[] = [];

      snapshot.forEach((child) => {
        const val = child.val();
        loaded.push({
          id: child.key!,
          text: val.text,
          owner: val.owner,
          timestamp: val.timestamp,
        });
      });

      loaded.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(loaded);

      if (loaded.length > 0) {
        setOldestTimestamp(loaded[0].timestamp);
      }
    });

    return () => unsubscribe();
  }, [user]);

  /* 🔽 PAGINATION */
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
        const ids = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !ids.has(m.id)), ...prev];
      });
      setOldestTimestamp(older[0].timestamp);
    }

    setLoadingMore(false);
  }

  /* 🔁 INFINITE SCROLL */
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

  /* 🔐 AUTH ACTIONS */
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

  /* ✍️ MESSAGE SEND */
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
      <div style={loginWrapper} className="loginWrap">
        <BackgroundFX />

        <div style={uniHeader}>Hochschule RheinMain</div>

        <div style={loginContent}>
          <h1 style={submissionTitle}>
            Abgabe Maschinelles Lernen
            <br />
            von Edvin Jashari
          </h1>

          <div style={loginCard}>
            <div style={{ padding: 26 }}>
              <p>Login nur mit @hs-rm.de</p>

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

/* ===== STYLES ===== */

const clockBar = { textAlign: "center", padding: 10, fontWeight: 600 };
const loginWrapper = { minHeight: "100vh", background: "#2563eb" };
const uniHeader = { color: "#fff", fontSize: 22, marginTop: 20 };
const loginContent = { marginTop: 40 };
const submissionTitle = { color: "#fff" };
const loginCard = { background: "#fff", borderRadius: 18 };
const appWrapper = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};
const chatContainer = {
  width: 700,
  height: "85vh",
  background: "#fff",
  display: "flex",
  flexDirection: "column",
};
const chatHeader = { padding: 12, textAlign: "right" };
const messagesBox = {
  flex: 1,
  padding: 14,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
};
const inputBar = { display: "flex", gap: 10, padding: 12 };
const input = { width: "100%", padding: 12, marginBottom: 10 };
const chatInput = { flex: 1, minHeight: 60 };
const primaryBtn = { padding: 12, background: "#2563eb", color: "#fff" };
const secondaryBtn = { padding: 12, background: "#e5e7eb" };
const sendBtn = { padding: "0 18px", background: "#2563eb", color: "#fff" };
const headerBtn = { padding: "8px 12px" };
const deleteBtn = { fontSize: 12, marginTop: 6 };

function BackgroundFX() {
  return null;
}
