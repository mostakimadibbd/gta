import React from "react";
import ReactDOM from "react-dom/client";
// Phase 14: the save-slot prefix layer MUST install (and run its
// legacy migration) before any game module reads localStorage —
// this import stays first among the app's own modules.
import "./game/saveslots";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
