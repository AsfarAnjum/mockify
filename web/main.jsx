import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import createApp from "@shopify/app-bridge";
import { getSessionToken } from "@shopify/app-bridge-utils";

/** -------------------------------
 *  App Bridge setup (v11 frontend)
 *  ------------------------------- */
const params = new URLSearchParams(window.location.search);
const host = params.get("host") || "";
if (!host) {
  console.warn("[App Bridge] Missing ?host param. If loading outside Admin, ensure you redirect via /auth/install and include host.");
}
// server.js injects this into index.html by replacing {{apiKey}}
const apiKey =
  window.__APP_BRIDGE_API_KEY__ ||
  import.meta?.env?.VITE_SHOPIFY_API_KEY ||
  "";
if (!apiKey) {
  console.error("[App Bridge] Missing API key. Ensure server injects __APP_BRIDGE_API_KEY__ or set VITE_SHOPIFY_API_KEY.");
}

// Create the App Bridge instance and make it globally available
export const appBridge = createApp({
  apiKey,
  host,
  forceRedirect: true,
});
window.__APP_BRIDGE_APP__ = appBridge;

/**
 * Helper to fetch with Shopify session token (JWT)
 */
export async function apiFetch(url, options = {}) {
  try {
    const token = await getSessionToken(appBridge);

    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    // If sending JSON, stringify it and set header
    if (
      options.body &&
      typeof options.body === "object" &&
      !(options.body instanceof FormData)
    ) {
      headers["Content-Type"] = "application/json";
      options = { ...options, body: JSON.stringify(options.body) };
    }

    return fetch(url, {
      ...options,
      headers,
      credentials: "omit",
    });
  } catch (err) {
    console.error("Error getting session token:", err);
    // Fallback: plain fetch (may return HTML/redirect if not authorized)
    return fetch(url, options);
  }
}

// Optional: make globally available
window.apiFetch = apiFetch;

const el = document.getElementById("root");
const root = createRoot(el);
root.render(<App />);