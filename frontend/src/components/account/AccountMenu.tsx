"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, MoreVertical, Settings } from "lucide-react";
import { CURRENT_USER, initialsFor } from "@/lib/account";
import "@/app/account.css";

/**
 * Bottom of the library sidebar: who is signed in, as a rounded pill with a
 * small menu. Sign-in is not wired yet, so the user is fixed and Sign out is
 * shown but inert.
 */
export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const user = CURRENT_USER;

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

  return (
    <div className="account-footer" ref={root}>
      <div className="account-card">
        <span className="account-avatar" aria-hidden="true">
          {initialsFor(user)}
        </span>
        <span className="account-name" title={user.email}>
          {user.name}
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
          <Link href="/settings" role="menuitem" onClick={() => setOpen(false)}>
            <Settings size={14} />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled
            title="Sign-in arrives with the accounts backend"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
