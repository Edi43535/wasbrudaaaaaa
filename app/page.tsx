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
  /* 🕒 LIVE UHR */
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

  /* 💬 REALTIME MESSAGES (onValue, korrekt) */
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
    if (!email) return alert("Bitte E-Mail eingeben");
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    alert("Passwort-Reset-Mail gesendet");
  }
  /* ✍️ MESSAGE SEND */
  async function pushMessage() {
    if (!message.trim()) return;

    if (!user?.email?.endsWith("@hs-rm.de")) {
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
      <div>
        {/* 🔴 HIER: dein kompletter Login JSX (unverändert) */}
      </div>
    );
  }

  /* 💬 CHAT */
  return (
    <div>
      {/* 🔴 HIER: dein kompletter Chat JSX + Styles (unverändert) */}
      <div ref={bottomRef} />
    </div>
  );
}
