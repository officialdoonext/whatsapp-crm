"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import {
  Bell,
  Bot,
  Crown,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  UsersRound,
  Workflow,
  X,
  Zap,
  ShoppingBag,
} from "lucide-react";
import type { AccountRole } from "@/lib/auth/roles";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";

const ROLE_CHIP: Record<
  AccountRole,
  { icon: typeof Crown; labelKey: string; className: string }
> = {
  owner: {
    icon: Crown,
    labelKey: "roleOwner",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  },
  admin: {
    icon: Shield,
    labelKey: "roleAdmin",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  agent: {
    icon: UserCog,
    labelKey: "roleAgent",
    className: "border-border bg-muted text-foreground",
  },
  viewer: {
    icon: User,
    labelKey: "roleViewer",
    className: "border-border bg-card text-muted-foreground",
  },
};

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  beta?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/inbox", labelKey: "inbox", icon: MessageSquare },
  { href: "/contacts", labelKey: "contacts", icon: Users },
  { href: "/pipelines", labelKey: "pipelines", icon: GitBranch },
  { href: "/commerce", labelKey: "commerce", icon: ShoppingBag },
  { href: "/broadcasts", labelKey: "broadcasts", icon: Radio },
  { href: "/automations", labelKey: "automations", icon: Zap },
  { href: "/flows", labelKey: "flows", icon: Workflow },
  { href: "/agents", labelKey: "aiAgents", icon: Bot },
];

const secondaryNavItems: NavItem[] = [
  { href: "/notifications", labelKey: "notifications", icon: Bell },
];

const bottomNavItems: NavItem[] = [
  { href: "/settings", labelKey: "settings", icon: Settings },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

const SIDEBAR_COLLAPSED_KEY = "wacrm.sidebar_collapsed";

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const { profile, profileLoading, account, accountRole } = useAuth();
  const totalUnread = useTotalUnread();
  const unreadNotifications = useUnreadNotifications();

  // Desktop collapsed state
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const showAccountStrip =
    !profileLoading &&
    !!account?.name &&
    account.name !== profile?.full_name;

  useEffect(() => {
    onClose?.();
  }, [pathname, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const renderLink = (item: NavItem) => {
    const isActive =
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href));

    const showUnreadDot =
      item.href === "/inbox" && totalUnread > 0 && !isActive;

    const showNotificationBadge =
      item.href === "/notifications" && unreadNotifications > 0;

    const Icon = item.icon;
    const label = t(item.labelKey as string);

    const content = (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 relative",
          collapsed
            ? "size-9 justify-center p-0 mx-auto"
            : "w-full px-3 py-2",
          isActive
            ? "bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/20"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        )}
      >
        <Icon className={cn("size-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground")} />

        {!collapsed && (
          <>
            <span className="flex-1 truncate">{label}</span>
            {item.beta && (
              <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-amber-500">
                BETA
              </span>
            )}
            {showUnreadDot && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
            {showNotificationBadge && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white shadow-xs">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </>
        )}

        {collapsed && (showUnreadDot || showNotificationBadge) && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <li key={item.href}>
          <Tooltip>
            <TooltipTrigger render={content} />
            <TooltipContent side="right" className="text-xs font-semibold">
              {label}
              {item.beta ? " (Beta)" : ""}
            </TooltipContent>
          </Tooltip>
        </li>
      );
    }

    return <li key={item.href}>{content}</li>;
  };

  return (
    <TooltipProvider delay={100}>
      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label={t("closeMenu")}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity lg:hidden",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
      />

      {/* Sidebar container */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200 lg:static lg:z-auto",
          collapsed ? "lg:w-14" : "lg:w-56",
          open
            ? "w-64 translate-x-0"
            : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Top Section */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
          {!collapsed ? (
            <>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/75">
                Navigation
              </span>
              <button
                type="button"
                onClick={toggleCollapsed}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-foreground hover:bg-muted hover:text-foreground transition-all shadow-xs cursor-pointer group"
              >
                <PanelLeftClose className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger render={
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                  className="flex size-8 items-center justify-center rounded-lg border border-border/70 bg-muted/50 text-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all shadow-xs cursor-pointer group mx-auto"
                >
                  <PanelLeftOpen className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              } />
              <TooltipContent side="right" className="text-xs font-semibold">
                Expand sidebar
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Primary Navigation list */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <ul className="space-y-0.5">{navItems.map((item) => renderLink(item))}</ul>

          <div className="my-2 border-t border-border/70" />

          <ul className="space-y-0.5">{secondaryNavItems.map((item) => renderLink(item))}</ul>
        </nav>

        {/* Bottom Section: Settings & Account */}
        <div className="shrink-0 border-t border-border p-2 space-y-1">
          <ul className="space-y-0.5">{bottomNavItems.map((item) => renderLink(item))}</ul>

          {/* Account name display (expanded only) */}
          {!collapsed && showAccountStrip && account?.name ? (
            <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground">
              <UsersRound className="size-4 shrink-0" />
              <span className="truncate font-semibold text-foreground/80" title={account.name}>
                {account.name}
              </span>
              {accountRole ? (
                (() => {
                  const meta = ROLE_CHIP[accountRole];
                  const ChipIcon = meta.icon;
                  return (
                    <span
                      className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.className}`}
                    >
                      <ChipIcon className="size-3" />
                      {t(meta.labelKey as string)}
                    </span>
                  );
                })()
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
    </TooltipProvider>
  );
}
