"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Bot,
  GitBranch,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Search,
  Settings,
  Users,
  Workflow,
  Zap,
  KeyRound,
  Shield,
  Palette,
  Coins,
  Tags,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface CommandSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchEntry {
  title: string;
  category: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

const SEARCH_ITEMS: SearchEntry[] = [
  { title: "Dashboard", category: "Core", href: "/dashboard", icon: LayoutDashboard },
  { title: "Inbox & Chats", category: "Core", href: "/inbox", icon: MessageSquare },
  { title: "Notifications", category: "Core", href: "/notifications", icon: Bell },
  { title: "Contacts & Audience", category: "Core", href: "/contacts", icon: Users },
  { title: "Pipelines & Deals", category: "Sales", href: "/pipelines", icon: GitBranch },
  { title: "Broadcast Campaigns", category: "Marketing", href: "/broadcasts", icon: Radio },
  { title: "Automations", category: "Automation", href: "/automations", icon: Zap },
  { title: "Flows Builder", category: "Automation", href: "/flows", icon: Workflow, badge: "Beta" },
  { title: "AI Reply & Agents", category: "AI", href: "/agents", icon: Bot },
  { title: "General Settings", category: "Settings", href: "/settings?tab=overview", icon: Settings },
  { title: "WhatsApp Cloud API", category: "Settings", href: "/settings?tab=whatsapp", icon: Zap },
  { title: "Message Templates", category: "Settings", href: "/settings?tab=templates", icon: MessageSquare },
  { title: "Team Members", category: "Settings", href: "/settings?tab=members", icon: Users },
  { title: "API Keys", category: "Settings", href: "/settings?tab=api", icon: KeyRound },
  { title: "Tags & Fields", category: "Settings", href: "/settings?tab=fields", icon: Tags },
  { title: "Pipelines & Currency", category: "Settings", href: "/settings?tab=deals", icon: Coins },
  { title: "Security & Passwords", category: "Settings", href: "/settings?tab=security", icon: Shield },
  { title: "Appearance & Themes", category: "Settings", href: "/settings?tab=appearance", icon: Palette },
];

export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const filtered = useMemo(() => {
    if (!query.trim()) return SEARCH_ITEMS;
    const q = query.toLowerCase();
    return SEARCH_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSelect = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl bg-card border-border shadow-2xl">
        <DialogTitle className="sr-only">Search CRM</DialogTitle>
        <div className="flex items-center border-b border-border px-3.5">
          <Search className="size-4 shrink-0 text-muted-foreground mr-2.5" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, settings, and navigation..."
            className="flex h-11 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex select-none items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-[340px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">
              No results found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item.href)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors group"
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center rounded bg-muted/60 text-muted-foreground group-hover:text-foreground">
                        <Icon className="size-3.5" />
                      </div>
                      <span className="flex-1 truncate text-foreground">
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider text-amber-500">
                          {item.badge}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground/70">
                        {item.category}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
