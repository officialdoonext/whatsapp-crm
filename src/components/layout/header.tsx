"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ExternalLink,
  GitBranch,
  HelpCircle,
  LogOut,
  Menu,
  MessageSquare,
  Plug,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { ConnectModal } from "@/components/layout/connect-modal";
import { CommandSearch } from "@/components/layout/command-search";
import { useTranslations } from "next-intl";

interface HeaderProps {
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const t = useTranslations("Header");
  const pathname = usePathname();
  const { profile, account, accountRole, signOut } = useAuth();
  const unreadNotifications = useUnreadNotifications();

  const [connectOpen, setConnectOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  const orgName = account?.name || "Doonext";
  const roleBadge = accountRole?.toUpperCase() || "FREE";

  return (
    <>
      <header className="flex h-12 w-full shrink-0 items-center justify-between border-b border-border bg-background px-3 text-sm">
        {/* Left Section: Logo + Breadcrumbs + Connect */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label={t("openMenu")}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Brand Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 group px-1 py-1 rounded-md hover:bg-muted/50 transition-colors"
          >
            <Image
              src="/logo.png"
              alt="Logo"
              width={24}
              height={24}
              className="size-6 object-contain rounded transition-transform group-hover:scale-105"
              priority
            />
          </Link>

          {/* Slash divider */}
          <span className="text-muted-foreground/30 font-light select-none text-xs">
            /
          </span>

          {/* Org Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors focus:outline-none">
              <span className="truncate max-w-[100px] sm:max-w-[130px] font-semibold">
                {orgName}
              </span>
              <span className="rounded border border-border bg-muted/40 px-1 py-0.2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                {roleBadge}
              </span>
              <ChevronsUpDown className="size-3 text-muted-foreground/60 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48 bg-popover border-border">
              <div className="px-2 py-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Organization
                </p>
                <p className="text-xs font-semibold text-foreground truncate mt-0.5">
                  {orgName}
                </p>
              </div>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=members"
                    className="text-xs text-popover-foreground hover:bg-accent"
                  />
                }
              >
                <User className="size-3.5" />
                Team Members
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=overview"
                    className="text-xs text-popover-foreground hover:bg-accent"
                  />
                }
              >
                <SettingsIcon className="size-3.5" />
                Organization Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Slash divider */}
          <span className="hidden sm:inline text-muted-foreground/30 font-light select-none text-xs">
            /
          </span>

          
        </div>

        {/* Right Section: Feedback + Search + Icons + User */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          {/* Theme Mode Toggle */}
          <ModeToggle className="size-7" />

          {/* User Profile Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center rounded-full p-0.5 hover:ring-2 hover:ring-border transition-all focus:outline-none"
              aria-label={t("openAccountMenu")}
            >
              <Avatar className="size-6 sm:size-7 border border-border">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? t("defaultAvatar")}
                  />
                ) : null}
                <AvatarFallback className="bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {initial}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="min-w-56 bg-popover text-popover-foreground border-border"
            >
              <div className="px-2 py-1.5">
                <p className="truncate text-xs font-semibold text-foreground">
                  {profile?.full_name ?? t("defaultUser")}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {profile?.email ?? ""}
                </p>
              </div>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    className="text-xs text-popover-foreground hover:bg-accent"
                  />
                }
              >
                <User className="size-3.5" />
                {t("menuProfile")}
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=whatsapp"
                    className="text-xs text-popover-foreground hover:bg-accent"
                  />
                }
              >
                <SettingsIcon className="size-3.5" />
                {t("menuSettings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={signOut}
                className="text-xs text-destructive hover:bg-destructive/10"
              >
                <LogOut className="size-3.5" />
                {t("menuSignOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Connect Modal & Command Search */}
      <ConnectModal open={connectOpen} onOpenChange={setConnectOpen} />
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
