"use client";

import { useState, useEffect } from "react";

export default function Page() {
  const [count, setCount] = useState(0);
  const [square, setSquare] = useState(0);

  useEffect(() => {
    setSquare(count * count);
  }, [count]);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Zahl: {count}</h1>
      <h2>Quadrat: {square}</h2>

      <button onClick={() => setCount(count + 1)}>+</button>
      <button onClick={() => setCount(count - 1)}>-</button>
    </div>
  );
}
