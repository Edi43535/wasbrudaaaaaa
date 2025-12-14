01 "use client";
02 
03 import { useState, useEffect } from "react";
04 
05 export default function Page() {
06   const [count, setCount] = useState(0);
07   const [square, setSquare] = useState(0);
08 
09   useEffect(() => {
10     setSquare(count * count);
11   }, [count]);
12 
13   return (
14     <div style={{ textAlign: "center", marginTop: "50px" }}>
15       <h1>Zahl: {count}</h1>
16       <h2>Quadrat: {square}</h2>
17 
18       <button onClick={() => setCount(count + 1)}>+</button>
19       <button onClick={() => setCount(count - 1)}>-</button>
20     </div>
21   );
22 }
