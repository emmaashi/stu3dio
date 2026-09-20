import { createLocalAuthClient } from "./localAuth";
import { createSupabaseAuthClient } from "./supabaseAuth";
import type { AuthClient } from "./types";

export * from "./types";

let client: AuthClient | null = null;

/** Supabase when both public env vars are set, otherwise browser-local accounts. */
export function getAuthClient(): AuthClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  client =
    url && anonKey
      ? createSupabaseAuthClient(url, anonKey)
      : createLocalAuthClient();
  return client;
}

/** Tests swap the client; production code never calls this. */
export function setAuthClientForTests(next: AuthClient | null) {
  client = next;
}
