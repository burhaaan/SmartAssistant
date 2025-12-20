// src/db.ts
import dotenv from "dotenv";
dotenv.config(); // safe no-op on Vercel, required for local dev

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export type TokenRow = {
  id: number;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  realm_id: string | null;
  expires_at: number | null;
  created_at: string;
  updated_at: string;
};

function normalize(row?: TokenRow) {
  if (!row) return null;
  return {
    userId: row.user_id,
    provider: row.provider,
    access_token: row.access_token,
    refresh_token: row.refresh_token ?? null,
    realmId: row.realm_id ?? null,
    expires_at: row.expires_at ?? null,
  };
}

export async function getTokens(userId: string, provider: string) {
  const { data, error } = await supabase
    .from("tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single<TokenRow>();
  if (error && error.code !== "PGRST116") throw error; // not found -> null
  return normalize(data as TokenRow | undefined);
}

export async function upsertTokens(row: {
  userId: string;
  provider: string;
  access_token: string;
  refresh_token?: string | null;
  realmId?: string | null;
  expires_at?: number | null;
}) {
  const payload = {
    user_id: row.userId,
    provider: row.provider,
    access_token: row.access_token,
    refresh_token: row.refresh_token ?? null,
    realm_id: row.realmId ?? null,
    expires_at: row.expires_at ?? null,
  };
  const { error } = await supabase.from("tokens").upsert(payload, {
    onConflict: "user_id,provider",
  });
  if (error) throw error;
}

export async function deleteTokens(userId: string, provider: string) {
  const { error } = await supabase
    .from("tokens")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw error;
}
