export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 700 }}>
        <h1 style={{ fontSize: 40, margin: 0 }}>Halöoo Edvin 👋</h1>
        <p style={{ fontSize: 22, marginTop: 14, lineHeight: 1.4 }}>
          Wie geht es dir heute? Ich habe Lust zu essen 😄
        </p>
      </div>
    </main>
  );
}
