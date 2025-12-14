"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";

import { auth } from "./config/firebase";

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 🔄 Prüfen, ob Nutzer schon eingeloggt ist
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });

    return () => unsubscribe();
  }, []);

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

  // FALL 1: NICHT eingeloggt
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

  // FALL 2: Eingeloggt
  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Willkommen</h1>
      <p>Eingeloggt als: {user.email}</p>

      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
