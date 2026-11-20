"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Ticket,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Trash2,
  Calendar,
  Percent,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Loader2,
  Tag,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";
import type { StoreCoupon } from "@/types";

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "order" | "product">("all");

  // Create modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form fields
  const [code, setCode] = useState("");
  const [couponType, setCouponType] = useState<"order" | "product">("order");
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("flat");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("0");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [description, setDescription] = useState("");

  // Delete modal state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Copied code feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/commerce/coupons?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load coupons");
      setCoupons(data.coupons || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleCopyCode = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`Copied code "${text}"`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleActive = async (coupon: StoreCoupon) => {
    try {
      const res = await fetch("/api/commerce/coupons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: coupon.id,
          is_active: !coupon.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update coupon status");
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: !c.is_active } : c))
      );
      toast.success(
        `Coupon ${coupon.code} is now ${!coupon.is_active ? "Active" : "Inactive"}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      toast.error("Coupon code is required");
      return;
    }
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) {
      toast.error("Please enter a valid discount value");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        code: trimmedCode,
        coupon_type: couponType,
        discount_type: discountType,
        discount_value: val,
        min_order_value: parseFloat(minOrderValue) || 0,
        max_discount: maxDiscount ? parseFloat(maxDiscount) : null,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        description: description.trim() || undefined,
        is_active: true,
      };

      const res = await fetch("/api/commerce/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create coupon");

      toast.success(`Coupon ${trimmedCode} created successfully!`);
      setIsAddOpen(false);
      resetForm();
      fetchCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create coupon");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCoupon = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/commerce/coupons?id=${deleteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete coupon");
      toast.success("Coupon deleted successfully");
      setCoupons((prev) => prev.filter((c) => c.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete coupon");
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setCode("");
    setCouponType("order");
    setDiscountType("flat");
    setDiscountValue("");
    setMinOrderValue("0");
    setMaxDiscount("");
    setValidUntil("");
    setDescription("");
  };

  const isExpired = (c: StoreCoupon) => {
    if (!c.valid_until) return false;
    return new Date(c.valid_until).getTime() < Date.now();
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
            <Ticket className="h-7 w-7 text-primary" />
            Discount Coupons
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create order coupons and product coupons with minimum order values and automatic eligibility checks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCoupons}
            disabled={loading}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-sm text-xs">
            <Plus className="h-4 w-4" />
            Add Coupon
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as "all" | "order" | "product")}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-3 w-full sm:w-72">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="order" className="text-xs">Order</TabsTrigger>
            <TabsTrigger value="product" className="text-xs">Product</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search code or terms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* Coupons List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : coupons.length === 0 ? (
        <Card className="border-dashed border-2 p-12 text-center bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Ticket className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold">No Coupons Found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            {search ? "No coupons matched your search criteria." : "Create your first discount coupon to boost cart conversions and shopper retention."}
          </p>
          <div className="mt-5">
            <Button onClick={() => setIsAddOpen(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Coupon
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => {
            const expired = isExpired(coupon);
            return (
              <Card
                key={coupon.id}
                className={`relative overflow-hidden transition-all shadow-2xs border ${
                  !coupon.is_active || expired
                    ? "opacity-60 bg-muted/30"
                    : "hover:border-primary/40 bg-card"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base bg-primary/10 text-primary px-2.5 py-1 rounded-md border border-primary/20 tracking-wide">
                        {coupon.code}
                      </span>
                      <button
                        onClick={() => handleCopyCode(coupon.id, coupon.code)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        title="Copy Code"
                      >
                        {copiedId === coupon.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={coupon.is_active}
                        onCheckedChange={() => handleToggleActive(coupon)}
                        title={coupon.is_active ? "Active" : "Disabled"}
                      />
                      <button
                        onClick={() => setDeleteId(coupon.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="Delete Coupon"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {coupon.coupon_type} Coupon
                    </Badge>
                    <Badge
                      className={`text-[10px] ${
                        coupon.discount_type === "percentage"
                          ? "bg-purple-600/10 text-purple-700 dark:text-purple-300 border-purple-300"
                          : "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-300"
                      }`}
                      variant="outline"
                    >
                      {coupon.discount_type === "percentage"
                        ? `${coupon.discount_value}% OFF`
                        : `₹${coupon.discount_value} FLAT OFF`}
                    </Badge>
                    {expired && (
                      <Badge variant="destructive" className="text-[10px]">
                        Expired
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0 text-xs">
                  {coupon.description && (
                    <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
                      {coupon.description}
                    </p>
                  )}

                  <div className="p-2.5 rounded-lg bg-muted/40 border space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Minimum Order:</span>
                      <span className="font-semibold text-foreground">
                        {coupon.min_order_value > 0 ? `₹${coupon.min_order_value}` : "No Minimum"}
                      </span>
                    </div>

                    {coupon.discount_type === "percentage" && coupon.max_discount && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Max Discount:</span>
                        <span className="font-semibold text-foreground">
                          Up to ₹{coupon.max_discount}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Valid Until:</span>
                      <span className="font-medium">
                        {coupon.valid_until
                          ? new Date(coupon.valid_until).toLocaleDateString()
                          : "No Expiry"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Times Used:</span>
                      <span className="font-semibold text-foreground">{coupon.used_count || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ADD COUPON MODAL */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Ticket className="h-5 w-5 text-primary" />
              Create Discount Coupon
            </DialogTitle>
            <DialogDescription>
              Configure offer codes that shoppers can apply in cart during checkout.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCoupon} className="space-y-4 py-2">
            {/* Coupon Code */}
            <div className="space-y-1.5">
              <Label htmlFor="coupon-code" className="text-xs font-semibold">
                Coupon Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="coupon-code"
                placeholder="e.g. WELCOME50, SAVE15, FLAT100"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono uppercase font-bold"
                required
              />
            </div>

            {/* Type & Discount Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Coupon Scope</Label>
                <select
                  value={couponType}
                  onChange={(e) => setCouponType(e.target.value as "order" | "product")}
                  className="w-full h-9 rounded-md border bg-background px-3 text-xs"
                >
                  <option value="order">Order Coupon (Entire Cart)</option>
                  <option value="product">Product Coupon (Specific Items)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Discount Mode</Label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as "percentage" | "flat")}
                  className="w-full h-9 rounded-md border bg-background px-3 text-xs"
                >
                  <option value="flat">Flat Amount (₹)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
            </div>

            {/* Discount Value & Min Order */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="disc-val" className="text-xs font-semibold">
                  Discount Value {discountType === "percentage" ? "(%)" : "(₹)"} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="disc-val"
                  type="number"
                  placeholder={discountType === "percentage" ? "15" : "50"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="min-order" className="text-xs font-semibold">
                  Min Order Value (₹)
                </Label>
                <Input
                  id="min-order"
                  type="number"
                  placeholder="299"
                  value={minOrderValue}
                  onChange={(e) => setMinOrderValue(e.target.value)}
                  min="0"
                />
              </div>
            </div>

            {/* Max Discount & Expiry */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="max-disc" className="text-xs font-semibold">
                  Max Discount Cap (₹) {discountType !== "percentage" && <span className="text-muted-foreground font-normal">(Optional)</span>}
                </Label>
                <Input
                  id="max-disc"
                  type="number"
                  placeholder="150"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  min="0"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="valid-until" className="text-xs font-semibold">
                  Valid Until <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Input
                  id="valid-until"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-xs font-semibold">
                Customer Description / Terms
              </Label>
              <Input
                id="desc"
                placeholder="e.g. Get flat ₹50 OFF on orders above ₹299"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating} className="gap-2 shadow-sm">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Coupon
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Coupon
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this coupon? Customers will no longer be able to apply it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCoupon} disabled={deleting} className="gap-2">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
