// import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PopupWindow from "@/components/PopupWindow";
import { restoreStateCurrent, saveWindowState, StateFlags, } from "@tauri-apps/plugin-window-state";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import "./lib/fontawesome";

window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("dragstart", (e) => e.preventDefault());

const params = new URLSearchParams(window.location.search);
const isPopup = params.has("popup");

if (!isPopup) {
  window.addEventListener("beforeunload", async () => {
    try {
      await saveWindowState(StateFlags.ALL);
    } catch (error) {
      console.error("Failed to save window state:", error);
    }
  });
}

function startApp() {
  if (!isPopup) {
    getCurrentWindow().show().catch((error) => {
      console.error("Failed to show main window:", error);
    });
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    isPopup ? <PopupWindow /> : <App />,
  );

  if (!isPopup) {
    window.setTimeout(() => {
      restoreStateCurrent().catch((error) => {
        console.error("Failed to restore window state:", error);
      });
    }, 0);
  }
}

startApp();