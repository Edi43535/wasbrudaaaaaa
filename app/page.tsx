export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: "20px",
        backgroundColor: "#111",
        color: "white",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ textAlign: "center", marginBottom: "20px" }}>
        Katzen-Galerie 🐱
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <img
          src="https://placekitten.com/400/300"
          alt="Süße Katze 1"
          style={{ width: "100%", borderRadius: "12px", objectFit: "cover" }}
        />
        <img
          src="https://placekitten.com/401/300"
          alt="Süße Katze 2"
          style={{ width: "100%", borderRadius: "12px", objectFit: "cover" }}
        />
        <img
          src="https://placekitten.com/400/301"
          alt="Süße Katze 3"
          style={{ width: "100%", borderRadius: "12px", objectFit: "cover" }}
        />
        <img
          src="https://placekitten.com/399/300"
          alt="Süße Katze 4"
          style={{ width: "100%", borderRadius: "12px", objectFit: "cover" }}
        />
      </div>
    </main>
  );
}
