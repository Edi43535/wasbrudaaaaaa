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

  const bottomRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* 🔐 Auth */
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  /* 📥 Initiale Nachrichten (letzte 50) */
  useEffect(() => {
    if (!user) return;

    const db = getDatabase(auth.app);
    const baseRef = ref(db, "messages");

    setMessages([]);
    setOldestTimestamp(null);

    const initialQuery = query(
      baseRef,
      orderByChild("timestamp"),
      limitToLast(PAGE_SIZE)
    );

    onChildAdded(initialQuery, (snap) => {
      const msg = { id: snap.key!, ...snap.val() };
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
      setOldestTimestamp((prev) =>
        prev === null ? msg.timestamp : Math.min(prev, msg.timestamp)
      );
    });

    onChildRemoved(initialQuery, (snap) => {
      setMessages((prev) => prev.filter((m) => m.id !== snap.key));
    });

    return () => off(initialQuery);
  }, [user]);

  /* 🔴 DAS WAR DER FEHLENDE TEIL */
  /* 📡 Listener für NEUE Nachrichten (ohne limit!) */
  useEffect(() => {
    if (!user) return;

    const db = getDatabase(auth.app);
    const baseRef = ref(db, "messages");

    const liveQuery = query(baseRef, orderByChild("timestamp"));

    onChildAdded(liveQuery, (snap) => {
      const msg = { id: snap.key!, ...snap.val() };
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
    });

    return () => off(liveQuery);
  }, [user]);

  /* 🔽 Ältere Nachrichten laden */
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

    snap.forEach((c) => older.push({ id: c.key!, ...c.val() }));
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

  useEffect(() => {
    if (!bottomRef.current) return;

    const observer = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) {
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
    if (!user?.email) return;
    await sendPasswordResetEmail(auth, user.email);
    alert("Passwort-Reset-Mail gesendet");
  }

  /* ✍️ Senden */
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

  /* LOGIN */
  if (!user) {
    return <div>Login bleibt unverändert</div>;
  }

  /* CHAT */
  return (
    <div>
      {messages
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((m) => (
          <div key={m.id}>
            {m.text}
            {m.owner === user.uid && (
              <button onClick={() => deleteMessage(m.id)}>Löschen</button>
            )}
          </div>
        ))}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={pushMessage}>Senden</button>

      <div ref={bottomRef} />
    </div>
  );
}
