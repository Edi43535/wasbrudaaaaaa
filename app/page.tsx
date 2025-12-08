export default function Page() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "red",
        color: "white",
        textAlign: "center",
        fontSize: "24px",
      }}
    >
      <p>Ich habe Hunger auf Pfannkuchen und Calvin ist faul</p>

      <img
        src="https://placekitten.com/300/300"
        alt="Katze"
        style={{
          marginTop: "20px",
          borderRadius: "12px",
        }}
      />
    </div>
  );
}
