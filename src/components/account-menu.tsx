"use client";
import { UiCopy } from "@/components/ui-language-provider";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  IconChevronDown,
  IconLogout,
  IconSettings,
  IconUserCircle,
} from "@tabler/icons-react";

import { logoutAction } from "@/app/auth-actions";
import { closeRealtime } from "@/components/realtime-bridge";
import { usePopover } from "@/components/use-popover";

export function AccountMenu({
  userId,
  name,
  hasAvatar,
  logoutLabel,
  managementLink,
}: {
  userId: number;
  name: string;
  hasAvatar: boolean;
  logoutLabel: string;
  managementLink: ReactNode;
}) {
  const {
    open,
    setOpen,
    rootRef: root,
    triggerRef: trigger,
  } = usePopover<HTMLDivElement>();
  const [avatarVersion, setAvatarVersion] = useState(0);

  useEffect(() => {
    const changed = () => setAvatarVersion(Date.now());
    window.addEventListener("openstudyhub:avatar-changed", changed);
    return () =>
      window.removeEventListener("openstudyhub:avatar-changed", changed);
  }, []);

  return (
    <div className="account-menu" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="account-trigger"
        aria-label={`Conta: ${name}`}
        aria-expanded={open}
        aria-controls="account-menu-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-initial" aria-hidden="true">
          {hasAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/profile-media/${userId}/avatar?v=${avatarVersion}`}
              alt=""
            />
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </span>
        <span className="account-name">{name}</span>
        <IconChevronDown
          className="account-chevron"
          size={14}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <nav
          id="account-menu-panel"
          className="account-menu-panel"
          aria-label="Conta"
          onClick={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest("a")) setOpen(false);
          }}
        >
          <div className="account-menu-heading">
            <span>
              <UiCopy pt="SUA CONTA" en="YOUR ACCOUNT" />
            </span>
            <strong>{name}</strong>
          </div>
          <Link href={`/profile/${userId}`}>
            <IconUserCircle size={18} aria-hidden="true" />
            <UiCopy pt="Perfil" en="Profile" />
          </Link>
          <Link href="/settings">
            <IconSettings size={18} aria-hidden="true" />{" "}
            <UiCopy pt="Configurações" en="Settings" />
          </Link>
          {managementLink}
          <form
            className="account-logout"
            action={logoutAction}
            onSubmit={closeRealtime}
          >
            <button type="submit">
              <IconLogout size={18} aria-hidden="true" /> {logoutLabel}
            </button>
          </form>
        </nav>
      ) : null}
    </div>
  );
}
