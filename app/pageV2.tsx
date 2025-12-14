// app/page.tsx
"use client";

import { useState } from "react";

export default function Page() {
  const [count, setCount] = useState(0);

  // normale Funktion
  function increment() {
    setCount(count + 1);
  }

  // Arrow Function
  const decrement = () => {
    setCount(count - 1);
  };

  return (
    <main style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>{count}</h1>

      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </main>
  );
}

