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
  const [latestTimestamp, setLatestTimestamp] = useState<number | null>(null);

  const [loadingMore, setLoadingMore] = useState(false);
  const [busyAuth, setBusyAuth] = useState(false);

  const [error, setError] = useState<string>("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Auth zuverlässig + schneller UX
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // ✅ Initiale Messages (schnell) + danach Realtime nur für neue
  useEffect(() => {
    if (!user) return;

    const db = getDatabase(auth.app);
    const baseRef = ref(db, "messages");

    let unsubscribeNew: null | (() => void) = null;
    let cancelled = false;

    async function initialLoad() {
      setError("");
      setMessages([]);
      setOldestTimestamp(null);
      setLatestTimestamp(null);

      try {
        // 1) Initial: letzte 50 laden (einmalig, schnell)
        const qInitial = query(baseRef, orderByChild("timestamp"), limitToLast(PAGE_SIZE));
        const snap = await get(qInitial);

        if (cancelled) return;

        const list: Message[] = [];
        snap.forEach((child) => {
          const val = child.val();
          list.push({
            id: child.key!,
            text: val?.text ?? "",
            owner: val?.owner ?? "",
            timestamp: val?.timestamp ?? 0,
          });
        });

        list.sort((a, b) => a.timestamp - b.timestamp);

        setMessages(list);

        if (list.length > 0) {
          const oldest = list[0].timestamp;
          const latest = list[list.length - 1].timestamp;
          setOldestTimestamp(oldest);
          setLatestTimestamp(latest);

          // 2) Realtime: nur neue Nachrichten ab "latest + 1"
          const qNew = query(baseRef, orderByChild("timestamp"), startAt(latest + 1));
          unsubscribeNew = onChildAdded(qNew, (childSnap) => {
            const val = childSnap.val();
            const msg: Message = {
              id: childSnap.key!,
              text: val?.text ?? "",
              owner: val?.owner ?? "",
              timestamp: val?.timestamp ?? 0,
            };

            setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
            setLatestTimestamp((prevLatest) =>
              prevLatest === null ? msg.timestamp : Math.max(prevLatest, msg.timestamp)
            );
          });
        } else {
          // Wenn noch keine Nachrichten existieren → trotzdem Listener ab jetzt
          const qNew = query(baseRef, orderByChild("timestamp"), startAt(0));
          unsubscribeNew = onChildAdded(qNew, (childSnap) => {
            const val = childSnap.val();
            const msg: Message = {
              id: childSnap.key!,
              text: val?.text ?? "",
              owner: val?.owner ?? "",
              timestamp: val?.timestamp ?? 0,
            };

            setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
            setOldestTimestamp((prevOld) => (prevOld === null ? msg.timestamp : Math.min(prevOld, msg.timestamp)));
            setLatestTimestamp((prevLatest) =>
              prevLatest === null ? msg.timestamp : Math.max(prevLatest, msg.timestamp)
            );
          });
        }
      } catch (e: any) {
        setError("Konnte Nachrichten nicht laden. Prüfe Realtime DB + Rules + Index (.indexOn: timestamp).");
      }
    }

    initialLoad();

    return () => {
      cancelled = true;
      if (unsubscribeNew) unsubscribeNew();
    };
  }, [user]);

  // ✅ Pagination: ältere Nachrichten (Batch-Load)
  async function loadMore() {
    if (!user || loadingMore || oldestTimestamp === null) return;

    setLoadingMore(true);
    setError("");

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
      snap.forEach((child) => {
        const val = child.val();
        older.push({
          id: child.key!,
          text: val?.text ?? "",
          owner: val?.owner ?? "",
          timestamp: val?.timestamp ?? 0,
        });
      });

      older.sort((a, b) => a.timestamp - b.timestamp);

      if (older.length > 0) {
        setMessages((prev) => {
          const existing = new Set(prev.map((m) => m.id));
          const merged = [...older.filter((m) => !existing.has(m.id)), ...prev];
          return merged;
        });
        setOldestTimestamp(older[0].timestamp);
      }
    } catch (e: any) {
      setError("Konnte ältere Nachrichten nicht laden.");
    } finally {
      setLoadingMore(false);
    }
  }

  // ✅ Debounced Infinite Scroll Trigger (wenn unten sichtbar)
  useEffect(() => {
    if (!bottomRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(loadMore, 220);
      }
    });

    observer.observe(bottomRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oldestTimestamp, user, loadingMore]);

  // ✅ UX: Domain Hinweis (nur Info – Security macht Rules!)
  const domainHint = useMemo(() => {
    if (!email.trim()) return "";
    return email.toLowerCase().endsWith("@hs-rm.de")
      ? ""
      : "Hinweis: Schreiben in die DB ist nur mit @hs-rm.de erlaubt (Rules).";
  }, [email]);

  // ✅ Auth Actions mit Fehleranzeige
  async function handleLogin() {
    setBusyAuth(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setError(
        e?.code === "auth/invalid-credential"
          ? "Login fehlgeschlagen: E-Mail oder Passwort falsch."
          : "Login fehlgeschlagen. Prüfe deine Daten."
      );
    } finally {
      setBusyAuth(false);
    }
  }

  async function handleRegister() {
    setBusyAuth(true);
    setError("");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setError(
        e?.code === "auth/email-already-in-use"
          ? "Diese E-Mail ist bereits registriert."
          : "Registrierung fehlgeschlagen. Prüfe E-Mail & Passwort."
      );
    } finally {
      setBusyAuth(false);
    }
  }

  async function handleLogout() {
    setError("");
    await signOut(auth);
  }

  async function handlePasswordReset() {
    setError("");
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      alert("Passwort-Reset-Mail gesendet");
    } catch {
      setError("Passwort-Reset fehlgeschlagen.");
    }
  }

  async function pushMessage() {
    setError("");
    if (!message.trim()) return;

    try {
      const db = getDatabase(auth.app);
      await push(ref(db, "messages"), {
        text: message,
        owner: user!.uid,
        timestamp: Date.now(),
      });
      setMessage("");
    } catch {
      setError("Senden fehlgeschlagen. Prüfe deine Rules (Domain @hs-rm.de?).");
    }
  }

  async function deleteMessage(id: string) {
    setError("");
    try {
      const db = getDatabase(auth.app);
      await remove(ref(db, `messages/${id}`));
    } catch {
      setError("Löschen fehlgeschlagen (Rules blockieren?).");
    }
  }

  // ✅ Auth Loading Screen
  if (authLoading) {
    return (
      <div className="bgWrap">
        <div className="topBrand">Hochschule RheinMain</div>
        <div className="centerStack">
          <div className="glassCard">
            <div className="spinner" />
            <div className="muted" style={{ marginTop: 12 }}>
              Verbinde mit Firebase…
            </div>
          </div>
        </div>

        <GlobalStyles />
      </div>
    );
  }

  // ✅ Login UI
  if (!user) {
    return (
      <div className="bgWrap">
        <div className="topBrand">Hochschule RheinMain</div>

        <div className="centerStack">
          <div className="titleBlock">
            <div className="titleBig">Abgabe Maschinelles Lernen</div>
            <div className="titleSub">von Edvin Jashari</div>
          </div>

          <div className="glassCard loginCard">
            <div className="cardHeader">
              <div className="badge">💬 Campus Chat</div>
              <div className="muted">Login nur mit Hochschul-Mail</div>
            </div>

            {error && <div className="alert">{error}</div>}

            <label className="label">E-Mail</label>
            <input
              className="input"
              placeholder="E-Mail (nur @hs-rm.de)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {domainHint && <div className="hint">{domainHint}</div>}

            <label className="label" style={{ marginTop: 10 }}>
              Passwort
            </label>
            <input
              className="input"
              type="password"
              placeholder="Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <div className="btnRow">
              <button className="btnPrimary" onClick={handleLogin} disabled={busyAuth}>
                {busyAuth ? "Bitte warten…" : "Login"}
              </button>

              <button className="btnGhost" onClick={handleRegister} disabled={busyAuth}>
                Registrieren
              </button>
            </div>

            <div className="finePrint">
              Sicherheit läuft über <b>Realtime Database Rules</b>, nicht über die Registrierung.
            </div>
          </div>
        </div>

        <GlobalStyles />
      </div>
    );
  }

  // ✅ Chat UI
  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.timestamp - b.timestamp),
    [messages]
  );

  return (
    <div className="chatPage">
      <div className="chatShell">
        <div className="chatTop">
          <div className="chatTitle">
            <div className="badge">💬 Campus Chat</div>
            <div className="mutedSmall">Eingeloggt als: {user.email ?? "User"}</div>
          </div>

          <div className="topActions">
            <button className="btnOutline" onClick={handlePasswordReset}>
              Passwort zurücksetzen
            </button>
            <button className="btnDanger" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        {error && <div className="alert" style={{ margin: "10px 14px" }}>{error}</div>}

        <div className="chatBody">
          {sortedMessages.map((m) => {
            const isOwn = m.owner === user.uid;
            return (
              <div
                key={m.id}
                className={`bubble ${isOwn ? "own" : "other"}`}
              >
                <div className="bubbleText">{m.text}</div>

                {isOwn && (
                  <div className="bubbleActions">
                    <button className="linkBtn" onClick={() => deleteMessage(m.id)}>
                      Löschen
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div ref={bottomRef} className="scrollSentinel">
            {loadingMore ? "Lade ältere Nachrichten…" : ""}
          </div>
        </div>

        <div className="chatComposer">
          <textarea
            className="composerInput"
            placeholder="Nachricht schreiben…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button className="sendBtn" onClick={pushMessage}>
            Senden
          </button>
        </div>
      </div>

      <GlobalStyles />
    </div>
  );
}

/** ✅ Premium Styles (global) */
function GlobalStyles() {
  return (
    <style jsx global>{`
      :root {
        --bg1: #1d4ed8;
        --bg2: #60a5fa;
        --card: rgba(255, 255, 255, 0.9);
        --border: rgba(255, 255, 255, 0.35);
        --shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
        --text: #0f172a;
        --muted: rgba(15, 23, 42, 0.68);
        --ring: rgba(59, 130, 246, 0.45);
        --outline: rgba(15, 23, 42, 0.14);
      }

      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color: var(--text); }

      .bgWrap {
        min-height: 100vh;
        background: radial-gradient(1200px 800px at 20% 20%, rgba(255,255,255,0.25), transparent 55%),
                    radial-gradient(900px 600px at 80% 30%, rgba(255,255,255,0.18), transparent 60%),
                    linear-gradient(135deg, var(--bg1), var(--bg2));
        padding: 22px 16px 40px;
        position: relative;
      }

      .topBrand {
        position: absolute;
        top: 18px;
        left: 0;
        right: 0;
        text-align: center;
        color: rgba(255,255,255,0.92);
        font-weight: 700;
        letter-spacing: 0.2px;
        font-size: 20px;
        text-shadow: 0 8px 22px rgba(0,0,0,0.25);
      }

      .centerStack {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 18px;
      }

      .titleBlock { text-align: center; color: rgba(255,255,255,0.95); }
      .titleBig {
        font-size: 30px;
        font-weight: 800;
        line-height: 1.1;
        text-shadow: 0 12px 30px rgba(0,0,0,0.25);
      }
      .titleSub {
        margin-top: 6px;
        font-size: 18px;
        font-weight: 600;
        opacity: 0.92;
      }

      .glassCard {
        width: min(420px, 92vw);
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 18px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(10px);
        padding: 22px;
      }

      .loginCard { padding: 22px 22px 18px; }

      .cardHeader { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(29, 78, 216, 0.10);
        border: 1px solid rgba(29, 78, 216, 0.22);
        font-weight: 700;
        width: fit-content;
      }

      .muted { color: var(--muted); font-size: 14px; }
      .mutedSmall { color: rgba(255,255,255,0.8); font-size: 12px; }

      .label { display: block; font-size: 13px; font-weight: 650; color: rgba(15,23,42,0.8); margin-bottom: 6px; }

      .input {
        width: 100%;
        padding: 12px 12px;
        border-radius: 12px;
        border: 1px solid var(--outline);
        outline: none;
        background: rgba(255,255,255,0.95);
        transition: box-shadow 160ms ease, border-color 160ms ease, transform 160ms ease;
        font-size: 15px;
      }
      .input:focus {
        border-color: rgba(59,130,246,0.55);
        box-shadow: 0 0 0 5px var(--ring);
      }

      .hint {
        margin-top: 8px;
        font-size: 12px;
        color: rgba(15, 23, 42, 0.65);
        background: rgba(15, 23, 42, 0.04);
        border: 1px dashed rgba(15, 23, 42, 0.18);
        padding: 10px 10px;
        border-radius: 12px;
      }

      .btnRow { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 14px; }
      @media (min-width: 520px) { .btnRow { grid-template-columns: 1fr 1fr; } }

      button { font: inherit; }

      .btnPrimary {
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.15);
        background: linear-gradient(135deg, rgba(29,78,216,1), rgba(37,99,235,1));
        color: #fff;
        font-weight: 750;
        box-shadow: 0 14px 30px rgba(29,78,216,0.35);
        cursor: pointer;
        transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease;
      }
      .btnPrimary:hover { transform: translateY(-1px); filter: brightness(1.02); }
      .btnPrimary:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

      .btnGhost {
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid rgba(15,23,42,0.18);
        background: rgba(255,255,255,0.6);
        color: rgba(15,23,42,0.92);
        font-weight: 750;
        cursor: pointer;
        transition: transform 160ms ease, box-shadow 160ms ease;
      }
      .btnGhost:hover { transform: translateY(-1px); box-shadow: 0 12px 28px rgba(0,0,0,0.08); }
      .btnGhost:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

      .finePrint {
        margin-top: 12px;
        font-size: 12px;
        color: rgba(15,23,42,0.58);
        text-align: center;
      }

      .alert {
        margin: 10px 0 14px;
        padding: 12px 12px;
        border-radius: 14px;
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.18);
        color: rgba(127, 29, 29, 0.92);
        font-size: 13px;
        font-weight: 650;
      }

      .spinner {
        width: 42px;
        height: 42px;
        border-radius: 999px;
        border: 4px solid rgba(15,23,42,0.12);
        border-top-color: rgba(29,78,216,0.95);
        animation: spin 0.9s linear infinite;
        margin: 0 auto;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* CHAT */
      .chatPage {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(1200px 800px at 15% 20%, rgba(59,130,246,0.12), transparent 60%),
                    radial-gradient(900px 600px at 80% 40%, rgba(29,78,216,0.10), transparent 60%),
                    #f1f5f9;
        padding: 20px;
      }

      .chatShell {
        width: min(760px, 96vw);
        height: 86vh;
        background: rgba(255,255,255,0.92);
        border: 1px solid rgba(15,23,42,0.10);
        border-radius: 18px;
        box-shadow: 0 26px 70px rgba(0,0,0,0.14);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .chatTop {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 14px 14px;
        background: linear-gradient(135deg, rgba(29,78,216,1), rgba(96,165,250,1));
        color: white;
      }

      .chatTitle { display: flex; flex-direction: column; gap: 6px; }
      .topActions { display: flex; gap: 10px; align-items: center; }

      .btnOutline {
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(255,255,255,0.14);
        border: 1px solid rgba(255,255,255,0.35);
        color: white;
        font-weight: 750;
        cursor: pointer;
        transition: transform 160ms ease, background 160ms ease;
      }
      .btnOutline:hover { transform: translateY(-1px); background: rgba(255,255,255,0.18); }

      .btnDanger {
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(239,68,68,0.18);
        border: 1px solid rgba(239,68,68,0.35);
        color: white;
        font-weight: 800;
        cursor: pointer;
        transition: transform 160ms ease, background 160ms ease;
      }
      .btnDanger:hover { transform: translateY(-1px); background: rgba(239,68,68,0.22); }

      .chatBody {
        flex: 1;
        padding: 14px;
        overflow-y: auto;
        background: linear-gradient(180deg, rgba(248,250,252,1), rgba(241,245,249,1));
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .bubble {
        max-width: 74%;
        border-radius: 16px;
        padding: 10px 12px;
        border: 1px solid rgba(15,23,42,0.10);
        box-shadow: 0 10px 22px rgba(0,0,0,0.06);
      }
      .bubble.own {
        align-self: flex-end;
        background: rgba(191,219,254,0.9);
        border-color: rgba(59,130,246,0.22);
      }
      .bubble.other {
        align-self: flex-start;
        background: rgba(229,231,235,0.9);
      }

      .bubbleText { font-size: 14.5px; line-height: 1.35; }

      .bubbleActions { margin-top: 6px; text-align: right; }
      .linkBtn {
        background: transparent;
        border: 1px solid rgba(29,78,216,0.25);
        color: rgba(29,78,216,0.95);
        padding: 6px 10px;
        border-radius: 999px;
        font-weight: 750;
        cursor: pointer;
        transition: transform 160ms ease, background 160ms ease;
      }
      .linkBtn:hover { transform: translateY(-1px); background: rgba(29,78,216,0.06); }

      .scrollSentinel {
        height: 18px;
        color: rgba(15,23,42,0.55);
        font-size: 12px;
        text-align: center;
        padding: 4px 0;
      }

      .chatComposer {
        display: flex;
        gap: 10px;
        padding: 12px;
        border-top: 1px solid rgba(15,23,42,0.10);
        background: rgba(255,255,255,0.86);
      }

      .composerInput {
        flex: 1;
        min-height: 64px;
        resize: none;
        border-radius: 14px;
        border: 1px solid rgba(15,23,42,0.14);
        padding: 10px 12px;
        outline: none;
        background: rgba(255,255,255,0.95);
        transition: box-shadow 160ms ease, border-color 160ms ease;
        font-size: 15px;
      }
      .composerInput:focus {
        border-color: rgba(59,130,246,0.55);
        box-shadow: 0 0 0 5px var(--ring);
      }

      .sendBtn {
        padding: 0 18px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.18);
        background: linear-gradient(135deg, rgba(29,78,216,1), rgba(37,99,235,1));
        color: white;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 14px 30px rgba(29,78,216,0.30);
        transition: transform 160ms ease, filter 160ms ease;
        min-width: 120px;
      }
      .sendBtn:hover { transform: translateY(-1px); filter: brightness(1.02); }
    `}</style>
  );
}
