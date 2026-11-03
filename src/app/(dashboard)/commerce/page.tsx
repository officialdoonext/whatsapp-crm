"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  CreditCard,
  DollarSign,
  Package,
  Layers,
  Clock,
  CheckCircle2,
  Send,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  MoreVertical,
  ArrowUpRight,
  Loader2,
  Eye,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { CommerceOrder, CommerceProduct, OrderStatus } from "@/types";

export default function CommercePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [generatingLinkOrderId, setGeneratingLinkOrderId] = useState<string | null>(null);

  // Metrics
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    pendingCount: 0,
    paidCount: 0,
    totalOrders: 0,
  });

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, [statusFilter]);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const url = statusFilter === "all"
        ? "/api/whatsapp/commerce/orders"
        : `/api/whatsapp/commerce/orders?status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders || []);
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      }
    } catch {
      toast.error("Failed to load commerce orders");
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/whatsapp/catalog/products?limit=100");
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
      }
    } catch {
      // quiet
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSendPaymentLink = async (orderId: string) => {
    setGeneratingLinkOrderId(orderId);
    try {
      const res = await fetch(`/api/whatsapp/commerce/orders/${orderId}/pay-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate payment link");
      toast.success(
        data.sent_to_whatsapp
          ? "Payment link generated and sent to customer on WhatsApp!"
          : `Payment link created: ${data.payment_url}`
      );
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate payment link");
    } finally {
      setGeneratingLinkOrderId(null);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const res = await fetch(`/api/whatsapp/commerce/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      toast.success(`Order status updated to ${status}`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "paid":
      case "completed":
        return (
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-[11px] gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold text-[11px] gap-1">
            Processing
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold text-[11px] gap-1">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    const refMatch = o.order_reference.toLowerCase().includes(q);
    const contactMatch = o.contact?.name?.toLowerCase().includes(q) || o.contact?.phone?.includes(q);
    return refMatch || contactMatch;
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ShoppingBag className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            WhatsApp Commerce & Orders
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your Meta Catalog products, incoming WhatsApp cart orders, and payment collection.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/settings?tab=commerce">
            <Button variant="outline" className="text-xs font-semibold">
              Configure Catalog & Pay
            </Button>
          </Link>
          <Button
            onClick={() => {
              fetchOrders();
              fetchProducts();
            }}
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loadingOrders ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              ${metrics.totalRevenue.toFixed(2)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">From WhatsApp completed payments</p>
        </div>

        {/* Pending Orders */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Orders
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {metrics.pendingCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Awaiting customer payment</p>
        </div>

        {/* Paid Orders */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Paid Orders
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {metrics.paidCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Ready for fulfillment</p>
        </div>

        {/* Catalog Products */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Catalog Items
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {products.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Active in Meta Commerce</p>
        </div>
      </div>

      {/* TABS: ORDERS & PRODUCTS */}
      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="orders" className="flex items-center gap-1.5 text-xs font-semibold">
            <CreditCard className="h-3.5 w-3.5" />
            Orders ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="catalog" className="flex items-center gap-1.5 text-xs font-semibold">
            <Package className="h-3.5 w-3.5" />
            Catalog Products ({products.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ORDERS */}
        <TabsContent value="orders" className="space-y-4 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders by reference, customer name, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <div className="flex gap-1">
                {(["all", "pending", "paid", "cancelled"] as const).map((s) => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(s)}
                    className="h-8 text-xs capitalize"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {loadingOrders ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/60 mb-2" />
              <h3 className="font-semibold text-foreground">No orders received yet</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                When customers browse your catalog in WhatsApp and click &ldquo;Send cart to business&rdquo;, their orders will land here instantly.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/70 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Order</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Items</th>
                    <th className="px-4 py-3 font-semibold">Total Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOrders.map((ord) => {
                    const isGenerating = generatingLinkOrderId === ord.id;
                    return (
                      <tr key={ord.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-foreground">
                          #{ord.order_reference}
                          <div className="text-[10px] font-normal text-muted-foreground">
                            {new Date(ord.created_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {ord.contact ? (
                            <Link
                              href={ord.conversation_id ? `/inbox?c=${ord.conversation_id}` : "/contacts"}
                              className="font-medium text-primary hover:underline flex items-center gap-1"
                            >
                              <span>{ord.contact.name || ord.contact.phone}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {ord.customer_note && (
                            <p className="text-[10px] text-muted-foreground italic truncate max-w-[180px]">
                              &ldquo;{ord.customer_note}&rdquo;
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-foreground">
                            {ord.items?.length || 0} items
                          </span>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {ord.items?.map((i) => `${i.quantity}x ${i.name || i.retailer_id}`).join(", ")}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground">
                          {ord.currency} {Number(ord.total_amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(ord.status)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {ord.status === "pending" && (
                              <Button
                                size="sm"
                                onClick={() => handleSendPaymentLink(ord.id)}
                                disabled={isGenerating}
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                              >
                                {isGenerating ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <Send className="mr-1 h-3 w-3" />
                                )}
                                Collect Pay
                              </Button>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-xs">
                                {ord.conversation_id && (
                                  <DropdownMenuItem onClick={() => router.push(`/inbox?c=${ord.conversation_id}`)}>
                                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                                    Open in Inbox
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleUpdateStatus(ord.id, "paid")}>
                                  Mark as Paid
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateStatus(ord.id, "completed")}>
                                  Mark Completed / Shipped
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleUpdateStatus(ord.id, "cancelled")}
                                  className="text-rose-600"
                                >
                                  Cancel Order
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: PRODUCTS */}
        <TabsContent value="catalog" className="space-y-4 pt-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Synced with Meta Commerce Catalog. Share any product directly with customers from the inbox composer.
            </p>
            <Link href="/settings?tab=commerce">
              <Button size="sm" className="text-xs bg-primary">
                Manage Catalog in Settings
              </Button>
            </Link>
          </div>

          {loadingProducts ? (
            <div className="flex h-36 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <Package className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="font-semibold text-foreground">No products found in local catalog</p>
              <p className="mt-1 text-xs">Configure your Catalog ID in Settings to sync your Meta products.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-all space-y-3"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
                    {p.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Package className="h-8 w-8" />
                      </div>
                    )}
                    <span className="absolute right-2 top-2 rounded-full bg-background/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-foreground">
                      {p.currency} {Number(p.price).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground truncate">{p.name}</h4>
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">SKU: {p.retailer_id}</p>
                    {p.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {p.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2 text-[11px]">
                    <span className="text-muted-foreground">{p.category || "General"}</span>
                    <Badge
                      variant="outline"
                      className={
                        p.availability === "in stock"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px]"
                      }
                    >
                      {p.availability}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
