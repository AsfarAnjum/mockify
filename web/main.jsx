import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { getSessionToken } from "@shopify/app-bridge-utils";

/** Fetch helper that adds Shopify session token (JWT) */
export async function apiFetch(url, options = {}) {
  const app = window.__APP_BRIDGE_APP__;
  // If App Bridge isn't ready yet, fall back to plain fetch
  if (!app) return fetch(url, options);

  const token = await getSessionToken(app);
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  // Add JSON content-type only when sending a plain object body
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options = { ...options, body: JSON.stringify(options.body) };
  }

  return fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });
}

// Optional: expose for easy use in other modules/components
window.apiFetch = apiFetch;

const el = document.getElementById("root");
const root = createRoot(el);
root.render(<App />);
