import { invoke } from "@tauri-apps/api/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { createTauriBackend, isTauri } from "./services/backend";
import { createMemoryBackend } from "./services/memoryBackend";
import "./styles/tokens.css";
import "./styles/app.css";

/**
 * The desktop build talks to Rust; `npm run dev` in a plain browser gets the
 * in-memory backend so the UI can be worked on without building the shell.
 */
const backend = isTauri() ? createTauriBackend(invoke) : createMemoryBackend();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App backend={backend} />
  </StrictMode>,
);
