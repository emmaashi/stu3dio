import { create } from "zustand";
import {
  getAuthClient,
  type AuthResult,
  type AuthUser,
  type SignInInput,
  type SignUpInput,
} from "@/lib/auth";

type AuthState = {
  status: "loading" | "signed-out" | "signed-in";
  user: AuthUser | null;
  mode: "supabase" | "local";
  init: () => () => void;
  signIn: (input: SignInInput) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  updateEmail: (email: string) => Promise<AuthResult>;
  updatePassword: (current: string, next: string) => Promise<AuthResult>;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  user: null,
  mode: "local",
  init: () => {
    const client = getAuthClient();
    set({ mode: client.mode });
    void client
      .getUser()
      .then((user) => set({ user, status: user ? "signed-in" : "signed-out" }));
    return client.onChange((user) =>
      set({ user, status: user ? "signed-in" : "signed-out" }),
    );
  },
  signIn: async (input) => {
    const result = await getAuthClient().signIn(input);
    if (result.ok) set({ user: result.user, status: "signed-in" });
    return result;
  },
  signUp: async (input) => {
    const result = await getAuthClient().signUp(input);
    if (result.ok) set({ user: result.user, status: "signed-in" });
    return result;
  },
  signOut: async () => {
    await getAuthClient().signOut();
    set({ user: null, status: "signed-out" });
  },
  updateEmail: async (email) => {
    const result = await getAuthClient().updateEmail(email);
    if (result.ok) set({ user: result.user });
    return result;
  },
  updatePassword: (current, next) =>
    getAuthClient().updatePassword(current, next),
}));
