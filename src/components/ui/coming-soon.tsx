"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  ArrowLeft,
  ShoppingBag,
  Package,
  CreditCard,
  Store,
  Layers,
  FolderTree,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  Compass,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PlannedFeature {
  title: string;
  description: string;
  icon?: LucideIcon;
  status?: "in-progress" | "planned" | "designing";
}

export interface ComingSoonPageProps {
  title: string;
  subtitle: string;
  badge?: string;
  icon: LucideIcon;
  features: PlannedFeature[];
}

const COMMERCE_NAV = [
  { href: "/commerce", label: "Overview", icon: ShoppingBag },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/store", label: "Store", icon: Store },
  { href: "/products", label: "Products", icon: Layers },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/variants", label: "Variants", icon: SlidersHorizontal },
];

export function ComingSoonPage({
  title,
  subtitle,
  badge = "Coming Soon",
  icon: MainIcon,
  features,
}: ComingSoonPageProps) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/commerce"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back to Commerce
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <MainIcon className="size-5" />
            </span>
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Compass className="mr-1.5 size-4" />
            Dashboard
          </Link>
          <Link
            href="/inbox"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <MessageSquare className="mr-1.5 size-4" />
            Shared Inbox
          </Link>
        </div>
      </div>

      {/* Sub-Navigation Tabs across all Commerce Modules */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border text-sm scrollbar-none">
        {COMMERCE_NAV.map((item) => {
          const isActive = pathname === item.href;
          const NavIcon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium text-xs whitespace-nowrap transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary font-semibold border border-primary/20 shadow-xs"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              <NavIcon className="size-3.5" />
              {item.label}
              {item.href !== "/commerce" && (
                <span className="text-[10px] uppercase tracking-wider opacity-70">
                  (Soon)
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Hero Coming Soon Card */}
      <Card className="relative overflow-hidden border-border/80 bg-linear-to-b from-card via-card to-muted/20 shadow-sm">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 size-56 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <CardContent className="pt-8 pb-10 text-center flex flex-col items-center">
          <Badge
            variant="outline"
            className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 text-xs border-primary/30 bg-primary/10 text-primary"
          >
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            <Sparkles className="size-3" />
            {badge}
          </Badge>

          <div className="relative mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted/80 border border-border shadow-inner text-foreground">
            <MainIcon className="size-8 text-primary" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground max-w-xl">
            {title} is Under Active Construction
          </h2>

          <p className="mt-2 text-sm text-muted-foreground max-w-lg leading-relaxed">
            We are engineering a native WhatsApp-first experience for {title.toLowerCase()}.
            Below is a preview of the capabilities arriving in the upcoming update.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full border border-border">
              <Clock className="size-3.5 text-amber-500" />
              Target Release: Next Feature Cycle
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full border border-border">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              Architecture & Data Schema Ready
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Planned Feature Cards Grid */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          What to Expect in {title}
        </h3>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, idx) => {
            const FeatureIcon = feature.icon || MainIcon;
            return (
              <Card
                key={idx}
                className="border-border/60 bg-card hover:border-primary/40 transition-colors shadow-xs"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground border border-border">
                      <FeatureIcon className="size-4 text-primary" />
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-medium text-muted-foreground border-border"
                    >
                      {feature.status === "in-progress"
                        ? "In Progress"
                        : feature.status === "designing"
                        ? "Design Review"
                        : "Planned"}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-semibold text-foreground">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
