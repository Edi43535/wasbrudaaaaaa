"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";

import { auth } from "../config/firebase";

const firebaseConfig = {
  apiKey: "AIzaSyBXGykQO9of0pezOeyHho288FBw9EcUWFc",
  authDomain: "tutorial-1---maschinelles.firebaseapp.com",
  databaseURL: "https://tutorial-1---maschinelles-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "tutorial-1---maschinelles",
  storageBucket: "tutorial-1---maschinelles.firebasestorage.app",
  messagingSenderId: "548405444098",
  appId: "1:548405444098:web:f87225b66d35800c5f711b"
};

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 🔄 Prüfen, ob User bereits eingeloggt ist
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
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

  // FALL 1: User NICHT eingeloggt → Login-Seite
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

  // FALL 2: User eingeloggt → Main-Seite
  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Willkommen</h1>
      <p>Eingeloggt als: {user.email}</p>

      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
