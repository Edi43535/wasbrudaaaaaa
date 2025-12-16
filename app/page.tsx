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
    await sendPasswordResetEmail(auth, email);
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
      <div style={loginWrapper} className="loginWrap">
        <BackgroundFX />

        <div style={uniHeader} className="fadeTop">
          Hochschule RheinMain
        </div>

        <div style={loginContent}>
          <h1 style={submissionTitle} className="titlePop">
            Abgabe Maschinelles Lernen <br />
            von Edvin Jashari
          </h1>

          <div style={loginCard} className="card3d cardEnter">
            <div className="cardGlow" />
            <div className="cardInner">
              <div className="pill">💬 Campus Chat</div>
              <p className="subText">Login nur mit @hs-rm.de</p>

              <div className="field">
                <span className="label">E-Mail</span>
                <input
                  style={input}
                  className="inputPro"
                  placeholder="E-Mail (nur @hs-rm.de)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="field">
                <span className="label">Passwort</span>
                <input
                  style={input}
                  className="inputPro"
                  type="password"
                  placeholder="Passwort"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                style={primaryBtn}
                className="btnPro primary"
                onClick={handleLogin}
              >
                Login
              </button>

              <button
                style={secondaryBtn}
                className="btnPro secondary"
                onClick={handleRegister}
              >
                Registrieren
              </button>

              <button
                style={secondaryBtn}
                className="btnPro secondary"
                onClick={handlePasswordReset}
              >
                Passwort zurücksetzen
              </button>

              <div className="tinyNote">
                Sicherheit wird über <b>Realtime Database Rules</b> geregelt.
              </div>
            </div>
          </div>
        </div>

        <GlobalStyles />
      </div>
    );
  }

  /* 💬 CHAT */
  return (
    <div style={appWrapper} className="chatWrap">
      <div style={chatContainer} className="chatCard">
        <div style={clockBar} className="clockBar">
          {now.toLocaleDateString("de-DE", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}{" "}
          – {now.toLocaleTimeString("de-DE")}
        </div>

        <div style={chatNotice} className="noticeBar">
          💬 Bitte bleibt freundlich und respektvoll 💙
        </div>

        <div style={chatHeader} className="chatHeader">
          <button style={headerBtn} className="hdrBtn" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div style={messagesBox} className="msgArea">
          {[...messages]
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((m) => {
              const isOwn = m.owner === user.uid;
              return (
                <div
                  key={m.id}
                  className={`bubble ${isOwn ? "own" : "other"}`}
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
                        className="delBtn"
                        onClick={() => deleteMessage(m.id)}
                      >
                        Löschen
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

          <div ref={bottomRef} className="sentinel">
            {loadingMore ? "Lade ältere Nachrichten…" : ""}
          </div>
        </div>

        <div style={inputBar} className="composer">
          <textarea
            style={chatInput}
            className="composerInput"
            placeholder="Nachricht schreiben…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button style={sendBtn} className="sendPro" onClick={pushMessage}>
            Senden
          </button>
        </div>
      </div>

      <GlobalStyles />
    </div>
  );
}

/* 🌌 Hintergrund-„3D“ FX (CSS-only) */
function BackgroundFX() {
  return (
    <>
      <div className="bg3d">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="spot s1" />
        <div className="spot s2" />
        <div className="grid3d" />
        <div className="grain" />
      </div>
    </>
  );
}

/* 🎨 STYLES + GlobalStyles */
/* (unverändert, exakt wie bei dir) */

function GlobalStyles() {
  return (
    <style jsx global>{`
      * { box-sizing: border-box; }
      body { margin: 0; font-family: ui-sans-serif, system-ui; }
    `}</style>
  );
}
