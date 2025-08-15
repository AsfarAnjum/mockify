import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { getSessionToken } from "@shopify/app-bridge-utils";

/**
 * Helper to fetch with Shopify session token (JWT)
 */
export async function apiFetch(url, options = {}) {
  // Wait until App Bridge is available
  const app = window.__APP_BRIDGE_APP__;
  if (!app) return fetch(url, options);

  try {
    const token = await getSessionToken(app);

    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

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
      credentials: "include",
    });
  } catch (err) {
    console.error("Error getting session token:", err);
    return fetch(url, options);
  }
}

// Make globally available if needed
window.apiFetch = apiFetch;

const el = document.getElementById("root");
const root = createRoot(el);
root.render(<App />);
