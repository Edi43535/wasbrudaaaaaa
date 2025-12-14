"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";

import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  off,
} from "firebase/database";

import { auth } from "./config/firebase";

/* Nachrichtentyp */
type Message = {
  id: string;
  text: string;
  owner: string;
  timestamp: number;
};

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 🔹 Realtime States
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");

  // 🔄 Login-Status prüfen
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  // 🔄 Realtime Database Listener
  useEffect(() => {
    if (!user) return;

    // 👉 Database DIREKT hier initialisiert (ohne firebase.ts)
    const db = getDatabase(auth.app);
    const messagesRef = ref(db, "messages");

    onChildAdded(messagesRef, (snapshot) => {
      setMessages((prev) => [
        ...prev,
        { id: snapshot.key!, ...snapshot.val() },
      ]);
    });

    onChildChanged(messagesRef, (snapshot) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === snapshot.key
            ? { id: snapshot.key!, ...snapshot.val() }
            : m
        )
      );
    });

    onChildRemoved(messagesRef, (snapshot) => {
      setMessages((prev) => prev.filter((m) => m.id !== snapshot.key));
    });

    return () => off(messagesRef);
  }, [user]);

  // 🔐 Login
  async function handleLogin() {
    await signInWithEmailAndPassword(auth, email, password);
  }

  // 📝 Registrierung
  async function handleRegister() {
    await createUserWithEmailAndPassword(auth, email, password);
  }

  // 🚪 Logout
  async function handleLogout() {
    await signOut(auth);
  }

  // ⬆️ Nachricht hochladen
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

  // ❌ NICHT eingeloggt
  if (!user) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h1>Login</h1>

        <input
          type="email"
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <br /><br />

        <input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <br /><br />

        <button onClick={handleLogin}>Login</button>
        <button onClick={handleRegister} style={{ marginLeft: "10px" }}>
          Register
        </button>
      </div>
    );
  }

  // ✅ Eingeloggt
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Logout oben rechts */}
      <div style={{ textAlign: "right", padding: "10px" }}>
        <button onClick={handleLogout}>Logout</button>
      </div>

      {/* Nachrichten (80%) */}
      <div
        style={{
          flex: 8,
          overflowY: "auto",
          padding: "10px",
          border: "1px solid #ccc",
        }}
      >
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: "8px" }}>
            <strong>{m.owner === user.uid ? "Ich" : "User"}:</strong>{" "}
            {m.text}
          </div>
        ))}
      </div>

      {/* Input unten */}
      <div
        style={{
          flex: 2,
          display: "flex",
          padding: "10px",
          gap: "10px",
        }}
      >
        <input
          style={{ flex: 1 }}
          placeholder="Nachricht eingeben..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button onClick={pushMessage}>Upload</button>
      </div>
    </div>
  );
}

