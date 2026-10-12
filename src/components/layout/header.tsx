"use client";

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

          {/* Supabase Green Bolt Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 group px-1 py-1 rounded-md hover:bg-muted/50 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              className="fill-emerald-500 transition-transform group-hover:scale-105"
            >
              <path d="M21.362 9.354H12V.346a.346.346 0 0 0-.589-.245L.103 11.41a.346.346 0 0 0 .245.59h9.362v9.008a.346.346 0 0 0 .589.245l11.308-11.309a.346.346 0 0 0-.245-.59z" />
            </svg>
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

          {/* Project Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger className="hidden sm:flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors focus:outline-none">
              <span className="truncate max-w-[120px]">My Project</span>
              <ChevronsUpDown className="size-3 text-muted-foreground/60 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44 bg-popover border-border">
              <div className="px-2 py-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Active Project
                </p>
                <p className="text-xs font-semibold text-foreground truncate mt-0.5">
                  My Project
                </p>
              </div>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                render={
                  <Link
                    href="/dashboard"
                    className="text-xs text-popover-foreground hover:bg-accent"
                  />
                }
              >
                Project Overview
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Slash divider */}
          <span className="hidden md:inline text-muted-foreground/30 font-light select-none text-xs">
            /
          </span>

          {/* Branch / Production badge */}
          <div className="hidden md:flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground">
            <GitBranch className="size-3 text-muted-foreground" />
            <span className="font-mono text-xs">main</span>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider text-amber-500">
              PRODUCTION
            </span>
            <ChevronsUpDown className="size-3 text-muted-foreground/60 shrink-0" />
          </div>

          {/* Green Connect Button */}
          <button
            type="button"
            onClick={() => setConnectOpen(true)}
            className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-medium shadow-sm transition-colors active:scale-95"
          >
            <Plug className="size-3" />
            <span>Connect</span>
          </button>
        </div>

        {/* Right Section: Feedback + Search + Icons + User */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Feedback */}
          <button
            type="button"
            onClick={() => window.open("https://github.com/ArnasDon/wacrm/issues", "_blank")}
            className="hidden sm:inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 transition-colors"
          >
            Feedback
          </button>

          {/* Search Trigger */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-md border border-border/80 bg-muted/40 hover:bg-muted/70 px-2 sm:px-2.5 py-1 text-xs text-muted-foreground transition-colors cursor-pointer"
          >
            <Search className="size-3.5 text-muted-foreground" />
            <span className="hidden md:inline">Search...</span>
            <kbd className="hidden sm:inline-flex select-none items-center gap-0.5 rounded border border-border bg-background px-1 py-0.2 font-mono text-[10px] text-muted-foreground">
              Ctrl K
            </kbd>
          </button>

          {/* Help icon */}
          <button
            type="button"
            onClick={() => window.open("https://github.com/ArnasDon/wacrm", "_blank")}
            title="Documentation & Help"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <HelpCircle className="size-4" />
          </button>

          {/* Notification Bell */}
          <Link
            href="/notifications"
            title="Notifications"
            className="relative flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Bell className="size-4" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 size-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </Link>

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
