"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Package,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  Filter,
  Search,
  RefreshCw,
  Phone,
  MapPin,
  ExternalLink,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  Check,
  Send,
  Boxes,
  CookingPot,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subYears,
  format,
} from "date-fns";
import { toast } from "sonner";
import type { StoreOrder, StoreOrderStage } from "@/types";

type DatePresetKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom"
  | "all";

const DATE_PRESETS: { key: DatePresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "last_week", label: "Last Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_year", label: "This Year" },
  { key: "last_year", label: "Last Year" },
  { key: "custom", label: "Custom Range" },
  { key: "all", label: "All Time" },
];

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getDateRangeFromPreset(
  preset: DatePresetKey,
  customStart?: string,
  customEnd?: string
): { startDate: string | null; endDate: string | null; label: string } {
  const now = new Date();

  switch (preset) {
    case "today": {
      const s = startOfDay(now);
      const e = endOfDay(now);
      return {
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        label: `Today (${format(now, "MMM d, yyyy")})`,
      };
    }
    case "yesterday": {
      const y = subDays(now, 1);
      const s = startOfDay(y);
      const e = endOfDay(y);
      return {
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        label: `Yesterday (${format(y, "MMM d, yyyy")})`,
      };
    }
    case "this_week": {
      const s = startOfWeek(now, { weekStartsOn: 1 });
      const e = endOfWeek(now, { weekStartsOn: 1 });
      return {
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        label: `This Week (${format(s, "MMM d")} - ${format(e, "MMM d, yyyy")})`,
      };
    }
    case "last_week": {
      const prev = subWeeks(now, 1);
      const s = startOfWeek(prev, { weekStartsOn: 1 });
      const e = endOfWeek(prev, { weekStartsOn: 1 });
      return {
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        label: `Last Week (${format(s, "MMM d")} - ${format(e, "MMM d, yyyy")})`,
      };
    }
    case "this_month": {
      const s = startOfMonth(now);
      const e = endOfMonth(now);
      return {
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        label: `This Month (${format(now, "MMMM yyyy")})`,
      };
    }
    case "last_month": {
      const prev = subMonths(now, 1);
      const s = startOfMonth(prev);
      const e = endOfMonth(prev);
      return {
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        label: `Last Month (${format(prev, "MMMM yyyy")})`,
      };
    }
    case "this_year": {
      const s = startOfYear(now);
      const e = endOfYear(now);
      return {
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        label: `This Year (${format(now, "yyyy")})`,
      };
    }
    case "last_year": {
      const prev = subYears(now, 1);
      const s = startOfYear(prev);
      const e = endOfYear(prev);
      return {
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        label: `Last Year (${format(prev, "yyyy")})`,
      };
    }
    case "custom": {
      const s = customStart ? startOfDay(parseLocalDate(customStart)).toISOString() : null;
      const e = customEnd ? endOfDay(parseLocalDate(customEnd)).toISOString() : null;
      let label = "Custom Range";
      if (customStart && customEnd) {
        label = `${customStart} to ${customEnd}`;
      } else if (customStart) {
        label = `From ${customStart}`;
      } else if (customEnd) {
        label = `Until ${customEnd}`;
      }
      return { startDate: s, endDate: e, label };
    }
    case "all":
    default:
      return { startDate: null, endDate: null, label: "All Time" };
  }
}

const STAGES: {
  id: StoreOrderStage;
  label: string;
  next?: StoreOrderStage;
  nextAction?: string;
  badgeClass: string;
}[] = [
  {
    id: "created",
    label: "Created",
    next: "preparing",
    nextAction: "Start Preparation",
    badgeClass: "bg-blue-600/10 text-blue-700 dark:text-blue-300 border-blue-300",
  },
  {
    id: "preparing",
    label: "Preparing",
    next: "packing",
    nextAction: "Start Packing",
    badgeClass: "bg-amber-600/10 text-amber-700 dark:text-amber-300 border-amber-300",
  },
  {
    id: "packing",
    label: "Packing",
    next: "packaged",
    nextAction: "Mark Packaged",
    badgeClass: "bg-sky-600/10 text-sky-700 dark:text-sky-300 border-sky-300",
  },
  {
    id: "packaged",
    label: "Package Done",
    next: "on_the_way",
    nextAction: "Dispatch / Out for Delivery",
    badgeClass: "bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 border-indigo-300",
  },
  {
    id: "on_the_way",
    label: "Out for Delivery",
    next: "delivered",
    nextAction: "Mark Delivered",
    badgeClass: "bg-purple-600/10 text-purple-700 dark:text-purple-300 border-purple-300",
  },
  {
    id: "delivered",
    label: "Delivered",
    badgeClass: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-300",
  },
  {
    id: "cancelled",
    label: "Cancelled",
    badgeClass: "bg-red-600/10 text-red-700 dark:text-red-300 border-red-300",
  },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Date Filter: default to "today" as requested
  const [datePreset, setDatePreset] = useState<DatePresetKey>("today");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [customStart, setCustomStart] = useState<string>(todayStr);
  const [customEnd, setCustomEnd] = useState<string>(todayStr);

  // Order Details Modal
  const [activeOrder, setActiveOrder] = useState<StoreOrder | null>(null);

  // Updating order stage state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = useCallback(
    async (
      targetPage = 1,
      currentStatus = statusFilter,
      currentSearch = search,
      currentPreset = datePreset,
      currentCustomStart = customStart,
      currentCustomEnd = customEnd
    ) => {
      setLoading(true);
      try {
        const { startDate, endDate } = getDateRangeFromPreset(
          currentPreset,
          currentCustomStart,
          currentCustomEnd
        );

        const params = new URLSearchParams({
          page: targetPage.toString(),
          limit: "24",
        });
        if (currentStatus !== "all") params.set("status", currentStatus);
        if (currentSearch.trim()) params.set("search", currentSearch.trim());
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const res = await fetch(`/api/commerce/orders?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to load orders");

        setOrders(data.orders || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setPage(data.page || targetPage);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, search, datePreset, customStart, customEnd]
  );

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  const handlePresetChange = (preset: DatePresetKey) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      fetchOrders(1, statusFilter, search, preset, customStart, customEnd);
    }
  };

  const handleApplyCustomRange = () => {
    if (!customStart || !customEnd) {
      toast.error("Please provide both start and end dates");
      return;
    }
    if (customStart > customEnd) {
      toast.error("Start date cannot be after end date");
      return;
    }
    fetchOrders(1, statusFilter, search, "custom", customStart, customEnd);
  };

  const activeDateInfo = getDateRangeFromPreset(datePreset, customStart, customEnd);

  const handleUpdateStatus = async (orderId: string, newStatus: StoreOrderStage) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch("/api/commerce/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: orderId,
          order_status: newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update order status");

      toast.success(`Order moved to "${newStatus.replace(/_/g, " ")}"`);
      if (data.notification?.sent) {
        toast.info(`WhatsApp notification dispatched to customer!`);
      }

      // Update in state
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...data.order } : o))
      );
      if (activeOrder && activeOrder.id === orderId) {
        setActiveOrder((prev) => (prev ? { ...prev, ...data.order } : null));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const getStageMeta = (status: StoreOrderStage) => {
    return STAGES.find((s) => s.id === status) || STAGES[0];
  };

  const formatCurrency = (amt: number) => `₹${Number(amt || 0).toFixed(2)}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
            <Package className="h-7 w-7 text-primary" />
            Orders Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track customer orders across the 6-stage delivery lifecycle and trigger automated WhatsApp notifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrders(page)}
            disabled={loading}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          <Tabs
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              fetchOrders(1, v, search, datePreset, customStart, customEnd);
            }}
            className="w-full xl:w-auto"
          >
            <TabsList className="flex flex-nowrap overflow-x-auto max-w-full h-auto gap-1 p-1 bg-muted/60">
              <TabsTrigger value="all" className="text-xs py-1.5 px-3">
                All Orders ({total})
              </TabsTrigger>
              <TabsTrigger value="created" className="text-xs py-1.5 px-3">
                Created
              </TabsTrigger>
              <TabsTrigger value="preparing" className="text-xs py-1.5 px-3">
                Preparing
              </TabsTrigger>
              <TabsTrigger value="packing" className="text-xs py-1.5 px-3">
                Packing
              </TabsTrigger>
              <TabsTrigger value="packaged" className="text-xs py-1.5 px-3">
                Package Done
              </TabsTrigger>
              <TabsTrigger value="on_the_way" className="text-xs py-1.5 px-3">
                On the Way
              </TabsTrigger>
              <TabsTrigger value="delivered" className="text-xs py-1.5 px-3">
                Delivered
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            {/* Date Preset Dropdown */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <Select
                value={datePreset}
                onValueChange={(v) => handlePresetChange(v as DatePresetKey)}
              >
                <SelectTrigger className="h-9 w-40 text-xs bg-background">
                  <SelectValue placeholder="Date Filter" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((preset) => (
                    <SelectItem key={preset.key} value={preset.key} className="text-xs">
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Order #, name, mobile..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  fetchOrders(1, statusFilter, e.target.value, datePreset, customStart, customEnd);
                }}
                className="pl-9 text-xs h-9"
              />
            </div>
          </div>
        </div>

        {/* Custom Date Range Picker Row (shown when 'custom' is selected) */}
        {datePreset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-md border bg-muted/40 animate-in fade-in-50 duration-200">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Custom Date Range:
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">From:</span>
              <div className="w-38">
                <DatePicker
                  value={customStart}
                  onChange={(val) => setCustomStart(val)}
                  placeholder="Start date"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">To:</span>
              <div className="w-38">
                <DatePicker
                  value={customEnd}
                  onChange={(val) => setCustomEnd(val)}
                  placeholder="End date"
                />
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleApplyCustomRange}
              className="h-9 px-3 text-xs"
            >
              Apply Filter
            </Button>
          </div>
        )}

        {/* Active Filter Indicator Strip */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Date Range:</span>
            <Badge variant="secondary" className="text-[11px] font-normal gap-1 bg-muted/80 border text-foreground">
              <Calendar className="h-3 w-3 text-primary" />
              {activeDateInfo.label}
            </Badge>
            {datePreset !== "all" && (
              <button
                type="button"
                onClick={() => handlePresetChange("all")}
                className="text-[11px] text-primary hover:underline"
              >
                (View All Time)
              </button>
            )}
          </div>
          <span>
            {total} {total === 1 ? "order" : "orders"} found
          </span>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <Card className="border-dashed border-2 p-12 text-center bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold">No Orders Found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            {search || statusFilter !== "all"
              ? "No orders matched your selected filters."
              : datePreset === "today"
              ? "No orders received today yet. Check another date filter (like Yesterday or This Month) or view all historical orders."
              : `No orders found for ${activeDateInfo.label.toLowerCase()}.`}
          </p>
          {datePreset !== "all" && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePresetChange("all")}
                className="text-xs gap-1.5"
              >
                <RefreshCw className="h-3 w-3" />
                View All Time Orders
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => {
              const stageMeta = getStageMeta(order.order_status);
              const isUpdating = updatingId === order.id;
              const cleanedPhone = order.customer_mobile.replace(/[^0-9]/g, "");

              return (
                <Card
                  key={order.id}
                  className="shadow-2xs hover:shadow-xs transition-all border flex flex-col justify-between"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-foreground">
                            {order.order_number}
                          </span>
                          <Badge variant="outline" className={`text-[10px] ${stageMeta.badgeClass}`}>
                            {stageMeta.label}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(order.created_at).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>

                      <span className="font-bold text-base text-foreground">
                        {formatCurrency(order.total_amount)}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0 text-xs flex-1">
                    {/* Customer Info */}
                    <div className="p-2.5 rounded-lg bg-muted/40 border space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground truncate max-w-[150px]">
                          {order.customer_name}
                        </span>
                        <a
                          href={`https://wa.me/${cleanedPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] text-emerald-600 hover:underline shrink-0"
                        >
                          <Phone className="h-3 w-3" />
                          Chat
                        </a>
                      </div>
                      <p className="text-muted-foreground text-[11px] truncate">
                        {order.delivery_address?.streetAddress || order.delivery_address?.rawAddress}
                      </p>
                    </div>

                    {/* Items Summary */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Items ({order.items?.length || 0}):
                      </span>
                      <div className="space-y-0.5 max-h-20 overflow-y-auto">
                        {order.items?.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex justify-between text-[11px]">
                            <span className="truncate pr-2">
                              {item.quantity}x {item.name} {item.variant_name ? `(${item.variant_name})` : ""}
                            </span>
                            <span className="text-muted-foreground shrink-0">
                              {formatCurrency(item.total_price)}
                            </span>
                          </div>
                        ))}
                        {order.items && order.items.length > 3 && (
                          <span className="text-[10px] text-muted-foreground italic">
                            +{order.items.length - 3} more items...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Payment Info */}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t">
                      <span className="text-muted-foreground uppercase font-mono">
                        {order.payment_method}
                      </span>
                      <Badge
                        variant={order.payment_status === "paid" ? "default" : "secondary"}
                        className={`text-[10px] py-0 px-2 ${
                          order.payment_status === "paid"
                            ? "bg-emerald-600 text-white"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}
                      >
                        {order.payment_status.toUpperCase()}
                      </Badge>
                    </div>
                  </CardContent>

                  {/* Actions Footer */}
                  <div className="p-3 border-t bg-muted/20 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveOrder(order)}
                      className="text-xs h-8 gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>

                    {stageMeta.next && stageMeta.nextAction && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(order.id, stageMeta.next!)}
                        disabled={isUpdating}
                        className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground shadow-2xs ml-auto"
                      >
                        {isUpdating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            {stageMeta.nextAction}
                            <ArrowRight className="h-3 w-3" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} ({total} total orders)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchOrders(page - 1)}
                  disabled={page <= 1 || loading}
                  className="text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchOrders(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW ORDER DETAILS MODAL */}
      <Dialog open={Boolean(activeOrder)} onOpenChange={(open) => !open && setActiveOrder(null)}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl max-h-[90vh] overflow-y-auto">
          {activeOrder && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                      <span>Order #{activeOrder.order_number}</span>
                      <Badge
                        variant="outline"
                        className={getStageMeta(activeOrder.order_status).badgeClass}
                      >
                        {getStageMeta(activeOrder.order_status).label}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-1">
                      Placed on {new Date(activeOrder.created_at).toLocaleString()}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5 py-2 text-xs">
                {/* Stage Progression Selector */}
                <div className="p-3.5 rounded-xl border bg-muted/30 space-y-2">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>Move Order Stage</span>
                    <span className="text-muted-foreground font-normal">
                      Triggers WhatsApp stage notification
                    </span>
                  </Label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                    {STAGES.filter((s) => s.id !== "cancelled").map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleUpdateStatus(activeOrder.id, s.id)}
                        disabled={updatingId === activeOrder.id}
                        className={`py-2 px-1 text-center rounded-lg border text-[11px] transition-all ${
                          activeOrder.order_status === s.id
                            ? "bg-primary text-primary-foreground font-bold border-primary shadow-xs"
                            : "bg-background hover:bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer & Address Details */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl border space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Customer Contact
                    </span>
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{activeOrder.customer_name}</p>
                      <p className="text-muted-foreground">{activeOrder.customer_mobile}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        window.open(
                          `https://wa.me/${activeOrder.customer_mobile.replace(/[^0-9]/g, "")}`,
                          "_blank"
                        )
                      }
                      className="w-full gap-1.5 text-xs bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20 border-emerald-300"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Chat on WhatsApp
                    </Button>
                  </div>

                  <div className="p-3.5 rounded-xl border space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Delivery Address
                    </span>
                    <p className="leading-relaxed whitespace-pre-wrap">
                      {activeOrder.delivery_address?.streetAddress ||
                        activeOrder.delivery_address?.rawAddress}
                      {activeOrder.delivery_address?.landmark
                        ? ` (Near: ${activeOrder.delivery_address.landmark})`
                        : ""}
                    </p>
                    {activeOrder.delivery_address?.latitude && (
                      <a
                        href={`https://maps.google.com/?q=${activeOrder.delivery_address.latitude},${activeOrder.delivery_address.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        Open in Google Maps
                      </a>
                    )}
                  </div>
                </div>

                {/* Ordered Items Table */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-muted/50 p-2.5 font-semibold text-xs border-b">
                    Ordered Items
                  </div>
                  <div className="divide-y max-h-56 overflow-y-auto">
                    {activeOrder.items?.map((item, i) => (
                      <div key={i} className="p-2.5 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-xs text-foreground">
                            {item.name}{" "}
                            {item.variant_name && (
                              <span className="text-muted-foreground font-normal">
                                • {item.variant_name}
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatCurrency(item.sale_price)} × {item.quantity}
                          </p>
                        </div>
                        <span className="font-semibold text-xs">
                          {formatCurrency(item.total_price)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="bg-muted/20 p-3 border-t space-y-1.5 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{formatCurrency(activeOrder.subtotal)}</span>
                    </div>

                    {activeOrder.discount_amount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Discount {activeOrder.coupon_code ? `(${activeOrder.coupon_code})` : ""}</span>
                        <span>-{formatCurrency(activeOrder.discount_amount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-muted-foreground">
                      <span>Delivery Fee</span>
                      <span>{activeOrder.delivery_fee > 0 ? formatCurrency(activeOrder.delivery_fee) : "FREE"}</span>
                    </div>

                    <div className="flex justify-between font-bold text-sm text-foreground pt-1 border-t">
                      <span>Total Amount</span>
                      <span>{formatCurrency(activeOrder.total_amount)}</span>
                    </div>
                  </div>
                </div>

                {/* Status Timeline */}
                {activeOrder.status_timeline && activeOrder.status_timeline.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Status Timeline
                    </span>
                    <div className="p-3 rounded-xl border bg-muted/20 space-y-2">
                      {activeOrder.status_timeline.map((step, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px]">
                          <span className="font-medium capitalize text-foreground">
                            • {step.status.replace(/_/g, " ")}
                            {step.note ? ` - ${step.note}` : ""}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(step.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setActiveOrder(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
