"use client";

import { useState, useEffect } from "react";

export default function Page() {
  const [count, setCount] = useState(0);
  const [square, setSquare] = useState(0);

  useEffect(() => {
    setSquare(count * count);
  }, [count]);

  return (
    <div>
      <p>Zahl: {count}</p>
      <p>Quadrat: {square}</p>
    </div>
  );
}
