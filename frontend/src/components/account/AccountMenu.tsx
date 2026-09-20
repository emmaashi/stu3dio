"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, MoreVertical, Settings, UserRound } from "lucide-react";
import { initialsFor } from "@/lib/auth";
import { useAuth } from "./useAuth";
import "@/app/account.css";

/**
 * Bottom of the library sidebar: who is signed in (or Guest), as a rounded
 * pill with a small menu for Sign in / Settings / Sign out.
 */
export default function AccountMenu() {
  const { status, user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (status === "loading") {
    return (
      <div
        className="account-footer account-footer--loading"
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="account-footer" ref={root}>
      <div className="account-card">
        <span
          className={`account-avatar ${user ? "" : "account-avatar--guest"}`}
          aria-hidden="true"
        >
          {user ? initialsFor(user) : <UserRound size={15} />}
        </span>
        <span className="account-name" title={user?.email}>
          {user ? user.displayName : "Guest"}
        </span>
        <button
          type="button"
          className="account-more"
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <MoreVertical size={15} />
        </button>
      </div>
      {open && (
        <div className="account-menu" role="menu" aria-label="Account">
          {!user && (
            <Link href="/login" role="menuitem" onClick={() => setOpen(false)}>
              <LogIn size={14} />
              Sign in
            </Link>
          )}
          <Link href="/settings" role="menuitem" onClick={() => setOpen(false)}>
            <Settings size={14} />
            Settings
          </Link>
          {user && (
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                await signOut();
                router.push("/");
              }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
