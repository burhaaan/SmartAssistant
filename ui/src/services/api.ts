// src/services/api.ts
const API_BASE =
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.DEV ? "http://localhost:4000" : "");

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
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return handle<{ reply: string }>(res);
}

// For OAuth, DON'T fetch; redirect the browser to backend.
export function redirectToQboConnect() {
  if (!API_BASE) {
    console.warn("VITE_API_BASE not set in production; cannot start OAuth");
  }
  window.location.href = `${API_BASE}/connect-qbo`;
}

export async function checkQboStatus() {
  const res = await fetch(`${API_BASE}/qbo-status`, { method: "GET" });
  return handle<{ connected: boolean }>(res);
}
