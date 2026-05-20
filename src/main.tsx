// import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";
import "./lib/fontawesome"
import { restoreStateCurrent, saveWindowState, StateFlags } from "@tauri-apps/plugin-window-state"

window.addEventListener("contextmenu", (e) => e.preventDefault())
window.addEventListener("dragstart", (e) => e.preventDefault())

window.addEventListener("beforeunload", async () => {
  try {
    await saveWindowState(StateFlags.ALL)
  } catch (error) {
    console.error("Failed to save window state:", error)
  }
})

async function startApp() {
  try {
    await restoreStateCurrent()
  } catch (error) {
    console.error("Failed to restore window state:", error)
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <App />
  )
}

startApp()