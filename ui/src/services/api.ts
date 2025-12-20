// src/services/api.ts
import { supabase } from "../lib/supabase";

const API_BASE =
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.DEV ? "http://localhost:4000" : "");

// Get current auth token
async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// Build headers with auth token
async function getHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// Tiny helper to surface better errors
async function handle<T = any>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.error || j.message || msg;
    } catch {
      const t = await res.text().catch(() => "");
      if (t) msg = `${msg}: ${t}`;
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function sendChatMessage(message: string) {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message }),
  });
  return handle<{ reply: string }>(res);
}

// For OAuth, include auth token in redirect URL state
export async function redirectToQboConnect() {
  if (!API_BASE) {
    console.warn("VITE_API_BASE not set in production; cannot start OAuth");
  }
  const token = await getAuthToken();
  const url = new URL(`${API_BASE}/connect-qbo`);
  if (token) {
    url.searchParams.set("auth_token", token);
  }
  window.location.href = url.toString();
}

export async function checkQboStatus() {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/qbo-status`, {
    method: "GET",
    headers,
  });
  return handle<{ connected: boolean }>(res);
}

export async function disconnectQbo() {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/disconnect-qbo`, {
    method: "POST",
    headers,
  });
  return handle<{ success: boolean }>(res);
}
