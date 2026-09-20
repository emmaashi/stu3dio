import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import {
  normalizeEmail,
  normalizeUsername,
  validateSignUp,
  type AuthClient,
  type AuthUser,
} from "./types";

/**
 * Supabase Auth for email + password, with usernames kept in a `profiles`
 * table (see supabase/auth.sql). Duplicate emails are refused; usernames are
 * checked through a SECURITY DEFINER function so the table itself stays private.
 */
export function createSupabaseAuthClient(
  url: string,
  anonKey: string,
): AuthClient {
  const supabase: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  async function toUser(user: User | null): Promise<AuthUser | null> {
    if (!user?.email) return null;
    const { data } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle();
    const metadataName = String(user.user_metadata?.username || "");
    const username = String(
      data?.username || metadataName || user.email.split("@")[0],
    );
    return {
      id: user.id,
      email: user.email,
      username,
      displayName: String(data?.display_name || username),
    };
  }

  return {
    mode: "supabase",
    async getUser() {
      const { data } = await supabase.auth.getUser();
      return toUser(data.user);
    },
    onChange(callback) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        void toUser(session?.user ?? null).then(callback);
      });
      return () => data.subscription.unsubscribe();
    },
    async signUp(input) {
      const invalid = validateSignUp(input);
      if (invalid) return invalid;
      const email = normalizeEmail(input.email);
      const username = normalizeUsername(input.username);
      const availability = await supabase.rpc("is_username_available", {
        candidate: username,
      });
      if (availability.error === null && availability.data === false)
        return {
          ok: false,
          field: "username",
          error: "That username is taken.",
        };
      const { data, error } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: { data: { username, display_name: username } },
      });
      if (error) {
        if (/already|registered|exists/i.test(error.message))
          return {
            ok: false,
            field: "email",
            error:
              "An account with this email already exists. Sign in instead.",
          };
        if (/username/i.test(error.message))
          return {
            ok: false,
            field: "username",
            error: "That username is taken.",
          };
        return { ok: false, error: error.message };
      }
      // With email confirmation on, Supabase answers an existing email with a
      // user that has no identities rather than an error.
      if (data.user && data.user.identities?.length === 0)
        return {
          ok: false,
          field: "email",
          error: "An account with this email already exists. Sign in instead.",
        };
      if (!data.session)
        return {
          ok: false,
          error: "Check your inbox to confirm your email, then sign in.",
        };
      const user = await toUser(data.user);
      return user
        ? { ok: true, user }
        : { ok: false, error: "Could not read your account." };
    },
    async signIn(input) {
      const identifier = input.identifier.trim();
      let email = normalizeEmail(identifier);
      if (!identifier.includes("@")) {
        const lookup = await supabase.rpc("email_for_username", {
          candidate: normalizeUsername(identifier),
        });
        if (lookup.error || !lookup.data)
          return {
            ok: false,
            field: "identifier",
            error: "No account with that username.",
          };
        email = String(lookup.data);
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: input.password,
      });
      if (error)
        return {
          ok: false,
          field: "password",
          error: "That email or password is not right.",
        };
      const user = await toUser(data.user);
      return user
        ? { ok: true, user }
        : { ok: false, error: "Could not read your account." };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
    async updateEmail(email) {
      const next = normalizeEmail(email);
      const { data, error } = await supabase.auth.updateUser({ email: next });
      if (error) return { ok: false, field: "email", error: error.message };
      await supabase
        .from("profiles")
        .update({ email: next })
        .eq("id", data.user.id);
      const user = await toUser(data.user);
      return user
        ? { ok: true, user }
        : { ok: false, error: "Could not read your account." };
    },
    async updatePassword(currentPassword, nextPassword) {
      if (nextPassword.length < 8)
        return {
          ok: false,
          field: "password",
          error: "Use at least 8 characters.",
        };
      const { data: current } = await supabase.auth.getUser();
      if (!current.user?.email)
        return { ok: false, error: "You are signed out." };
      const check = await supabase.auth.signInWithPassword({
        email: current.user.email,
        password: currentPassword,
      });
      if (check.error)
        return {
          ok: false,
          field: "password",
          error: "Your current password is not right.",
        };
      const { data, error } = await supabase.auth.updateUser({
        password: nextPassword,
      });
      if (error) return { ok: false, field: "password", error: error.message };
      const user = await toUser(data.user);
      return user
        ? { ok: true, user }
        : { ok: false, error: "Could not read your account." };
    },
  };
}
