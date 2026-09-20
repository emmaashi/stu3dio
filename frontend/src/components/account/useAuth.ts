"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";

/** Subscribes this tree to the account session; safe to call from many places. */
export function useAuth() {
  const state = useAuthStore();
  useEffect(() => useAuthStore.getState().init(), []);
  return state;
}
