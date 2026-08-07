import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import Cockpit from "./App.jsx";
import Login from "./Login.jsx";
import { checkSession, logout, setUnauthorisedHandler } from "./api.js";
import "./styles.css";

function Root() {
  const [state, setState] = useState("checking");

  useEffect(() => {
    setUnauthorisedHandler(() => setState("out"));
    checkSession().then((ok) => setState(ok ? "in" : "out"));
  }, []);

  if (state === "checking") return <div style={{ minHeight: "100vh", background: "#0A0A0A" }} />;
  if (state === "out") return <Login onIn={() => setState("in")} />;

  return (
    <Cockpit
      onLogout={async () => {
        await logout();
        setState("out");
      }}
      googleConnected={new URLSearchParams(location.search).get("connected")}
    />
  );
}

createRoot(document.getElementById("root")).render(<Root />);
