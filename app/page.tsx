"use client";

import { useState } from "react";

export default function Page() {
  const [user, setUser] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Login / Register (gleiches Verhalten)
  function handleLogin() {
    setUser(email);
  }

  // Logout
  function handleLogout() {
    setUser(null);
    setEmail("");
    setPassword("");
  }

  // FALL 1: User ist NICHT eingeloggt → Login-Seite
  if (user === null) {
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
        <button onClick={handleLogin} style={{ marginLeft: "10px" }}>
          Register
        </button>
      </div>
    );
  }

  // FALL 2: User ist eingeloggt → Main-Seite
  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Willkommen</h1>
      <p>Eingeloggt als: {user}</p>

      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
