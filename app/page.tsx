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
      <div style={loginWrapper} className="loginWrap">
        <BackgroundFX />

        <div style={uniHeader} className="fadeTop">
          Hochschule RheinMain
        </div>

        <div style={loginContent}>
          <h1 style={submissionTitle} className="titlePop">
            Abgabe Maschinelles Lernen
            <br />
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

              <button style={primaryBtn} className="btnPro primary" onClick={handleLogin}>
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
        {/* 🕒 LIVE-UHR */}
        <div style={clockBar} className="clockBar">
          {now.toLocaleDateString("de-DE", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}{" "}
          – {now.toLocaleTimeString("de-DE")}
        </div>

        {/* ✅ Hinweis */}
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
                      <button style={deleteBtn} className="delBtn" onClick={() => deleteMessage(m.id)}>
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

/* 🎨 STYLES (bestehende + UI-only Ergänzungen) */

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

const loginWrapper = {
  minHeight: "100vh",
  background: "linear-gradient(135deg,#2563eb,#60a5fa)",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  position: "relative" as const,
  overflow: "hidden" as const,
};

const uniHeader = {
  marginTop: 30,
  fontSize: 22,
  fontWeight: 700,
  color: "#fff",
  letterSpacing: 0.2,
  textShadow: "0 10px 30px rgba(0,0,0,0.25)",
  zIndex: 2,
};

const loginContent = {
  marginTop: 40,
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  zIndex: 2,
};

const submissionTitle = {
  color: "#fff",
  textAlign: "center" as const,
  marginBottom: 22,
  fontSize: 28,
  fontWeight: 800,
  textShadow: "0 12px 35px rgba(0,0,0,0.25)",
  zIndex: 2,
};

const loginCard = {
  width: 420,
  maxWidth: "92vw",
  background: "rgba(255,255,255,0.92)",
  borderRadius: 18,
  boxShadow: "0 30px 80px rgba(0,0,0,0.28)",
  textAlign: "center" as const,
  border: "1px solid rgba(255,255,255,0.35)",
  backdropFilter: "blur(10px)",
  overflow: "hidden" as const,
  position: "relative" as const,
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
  overflow: "hidden" as const,
};

const chatHeader = {
  padding: 12,
  textAlign: "right" as const,
  background: "rgba(255,255,255,0.6)",
  backdropFilter: "blur(6px)",
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
  background: "rgba(255,255,255,0.86)",
  backdropFilter: "blur(8px)",
};

const input = {
  width: "100%",
  padding: 12,
  marginBottom: 12,
  borderRadius: 12,
  border: "1px solid rgba(15,23,42,0.18)",
  outline: "none",
};

const chatInput = {
  flex: 1,
  minHeight: 60,
  resize: "none" as const,
  borderRadius: 12,
  padding: 12,
  border: "1px solid rgba(15,23,42,0.18)",
  outline: "none",
};

const primaryBtn = {
  width: "100%",
  padding: 12,
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  cursor: "pointer",
  marginBottom: 10,
  fontWeight: 800,
};

const secondaryBtn = {
  ...primaryBtn,
  background: "#e5e7eb",
  color: "#0f172a",
};

const sendBtn = {
  padding: "0 18px",
  background: "#2563eb",
  color: "#fff",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  fontWeight: 800,
  minWidth: 120,
};

const headerBtn = {
  marginLeft: 8,
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,0.16)",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const deleteBtn = {
  fontSize: 12,
  marginTop: 4,
  background: "transparent",
  border: "none",
  color: "#1d4ed8",
  cursor: "pointer",
  fontWeight: 700,
};

function GlobalStyles() {
  return (
    <style jsx global>{`
      * { box-sizing: border-box; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; }

      /* ---------- LOGIN PREMIUM FX ---------- */
      .bg3d {
        position: absolute;
        inset: -40px;
        pointer-events: none;
        transform: translateZ(0);
        z-index: 1;
      }

      .blob {
        position: absolute;
        width: 520px;
        height: 520px;
        border-radius: 999px;
        filter: blur(22px);
        opacity: 0.45;
        animation: drift 14s ease-in-out infinite;
        transform: translate3d(0,0,0);
      }

      .b1 { left: -120px; top: -80px; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(255,255,255,0.0) 55%), radial-gradient(circle at 70% 70%, rgba(96,165,250,0.75), rgba(37,99,235,0.15)); }
      .b2 { right: -140px; top: 60px; width: 580px; height: 580px; background: radial-gradient(circle at 35% 35%, rgba(255,255,255,0.85), rgba(255,255,255,0.0) 55%), radial-gradient(circle at 70% 60%, rgba(59,130,246,0.55), rgba(29,78,216,0.12)); animation-delay: -5s; }
      .b3 { left: 18%; bottom: -240px; width: 680px; height: 680px; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.55), rgba(255,255,255,0.0) 60%), radial-gradient(circle at 70% 65%, rgba(147,197,253,0.55), rgba(37,99,235,0.08)); animation-delay: -9s; }

      .spot {
        position: absolute;
        inset: 0;
        background: radial-gradient(800px 420px at 18% 18%, rgba(255,255,255,0.18), transparent 60%),
                    radial-gradient(680px 360px at 82% 28%, rgba(255,255,255,0.14), transparent 62%),
                    radial-gradient(900px 520px at 55% 92%, rgba(255,255,255,0.10), transparent 66%);
        opacity: 0.9;
        animation: breathe 10s ease-in-out infinite;
      }

      .grid3d {
        position: absolute;
        left: 50%;
        top: 58%;
        width: 1400px;
        height: 900px;
        transform: translate(-50%, -50%) perspective(900px) rotateX(70deg) rotateZ(10deg);
        background-image:
          linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px);
        background-size: 60px 60px;
        mask-image: radial-gradient(circle at 50% 40%, rgba(0,0,0,0.95), transparent 70%);
        opacity: 0.55;
        animation: gridMove 12s linear infinite;
      }

      .grain {
        position: absolute;
        inset: 0;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.20'/%3E%3C/svg%3E");
        opacity: 0.12;
        mix-blend-mode: overlay;
      }

      @keyframes drift {
        0%, 100% { transform: translate3d(0px, 0px, 0) scale(1); }
        50% { transform: translate3d(40px, -18px, 0) scale(1.05); }
      }
      @keyframes breathe {
        0%, 100% { opacity: 0.85; }
        50% { opacity: 1; }
      }
      @keyframes gridMove {
        0% { background-position: 0 0, 0 0; }
        100% { background-position: 0 180px, 0 180px; }
      }

      .fadeTop { animation: fadeDown 700ms ease both; }
      .titlePop { animation: popIn 650ms cubic-bezier(.2,.9,.2,1) both; }
      .cardEnter { animation: cardIn 800ms cubic-bezier(.2,.9,.2,1) both; }

      @keyframes fadeDown {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes popIn {
        from { opacity: 0; transform: translateY(10px) scale(.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes cardIn {
        from { opacity: 0; transform: translateY(16px) scale(.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .card3d { position: relative; }
      .cardGlow {
        position: absolute;
        inset: -2px;
        background: radial-gradient(600px 240px at 50% 0%, rgba(59,130,246,0.35), transparent 60%),
                    radial-gradient(420px 240px at 10% 30%, rgba(255,255,255,0.25), transparent 60%),
                    radial-gradient(500px 260px at 90% 35%, rgba(147,197,253,0.25), transparent 62%);
        filter: blur(12px);
        opacity: 0.85;
      }
      .cardInner { position: relative; padding: 26px; }

      .pill {
        display: inline-flex;
        padding: 8px 12px;
        border-radius: 999px;
        font-weight: 800;
        background: rgba(29,78,216,0.10);
        border: 1px solid rgba(29,78,216,0.22);
      }
      .subText { margin: 10px 0 18px; color: rgba(15,23,42,0.65); font-weight: 600; }

      .field { text-align: left; margin-bottom: 12px; }
      .label { display:block; font-size: 12px; font-weight: 800; color: rgba(15,23,42,0.75); margin-bottom: 6px; }
      .inputPro {
        width: 100%;
        padding: 12px 12px;
        border-radius: 12px;
        border: 1px solid rgba(15,23,42,0.18);
        background: rgba(255,255,255,0.96);
        transition: box-shadow 160ms ease, border-color 160ms ease, transform 160ms ease;
      }
      .inputPro:focus {
        border-color: rgba(59,130,246,0.55);
        box-shadow: 0 0 0 5px rgba(59,130,246,0.18);
        transform: translateY(-1px);
      }

      .btnPro {
        width: 100%;
        border-radius: 12px;
        padding: 12px;
        font-weight: 900;
        transition: transform 160ms ease, filter 160ms ease, box-shadow 160ms ease;
      }
      .btnPro.primary {
        background: linear-gradient(135deg, rgba(29,78,216,1), rgba(37,99,235,1));
        color: white;
        box-shadow: 0 16px 36px rgba(29,78,216,0.25);
      }
      .btnPro.secondary {
        background: rgba(15,23,42,0.06);
        color: rgba(15,23,42,0.95);
        border: 1px solid rgba(15,23,42,0.14);
      }
      .btnPro:hover { transform: translateY(-1px); filter: brightness(1.02); }
      .btnPro:active { transform: translateY(0px); }

      .tinyNote {
        margin-top: 12px;
        font-size: 12px;
        color: rgba(15,23,42,0.55);
      }

      /* ---------- CHAT POLISH (UI only) ---------- */
      .chatCard { overflow: hidden; }
      .chatHeader .hdrBtn { transition: transform 140ms ease, box-shadow 140ms ease; }
      .chatHeader .hdrBtn:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0,0,0,0.10); }

      .bubble { transition: transform 140ms ease, box-shadow 140ms ease; }
      .bubble:hover { transform: translateY(-1px); box-shadow: 0 12px 22px rgba(0,0,0,0.10); }

      .composerInput:focus { box-shadow: 0 0 0 5px rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.55); }

      .sendPro { transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease; }
      .sendPro:hover { transform: translateY(-1px); box-shadow: 0 16px 34px rgba(29,78,216,0.25); filter: brightness(1.02); }
      .sendPro:active { transform: translateY(0); }

      .delBtn { opacity: 0.85; transition: opacity 140ms ease, transform 140ms ease; }
      .delBtn:hover { opacity: 1; transform: translateY(-1px); }

      .sentinel { text-align: center; font-size: 12px; color: rgba(15,23,42,0.55); padding: 6px 0; }
    `}</style>
  );
}
