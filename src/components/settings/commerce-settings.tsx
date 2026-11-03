"use client";

import { useEffect, useState } from "react";
import {
  ShoppingBag,
  CreditCard,
  RefreshCw,
  Plus,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Search,
  Loader2,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { SettingsPanelHead } from "./settings-panel-head";
import type { CommerceProduct, PaymentProvider } from "@/types";

const MASKED = "••••••••••••••••";

export function CommerceSettings() {
  const [activeTab, setActiveTab] = useState<"catalog" | "payments">("catalog");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Config State
  const [catalogId, setCatalogId] = useState("");
  const [catalogName, setCatalogName] = useState<string | null>(null);
  const [catalogConnectedAt, setCatalogConnectedAt] = useState<string | null>(null);
  const [isWhatsappConnected, setIsWhatsappConnected] = useState(false);

  // Payment State
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>("manual");
  const [autoPaymentLink, setAutoPaymentLink] = useState(false);

  // Razorpay
  const [rzpKeyId, setRzpKeyId] = useState("");
  const [rzpKeySecret, setRzpKeySecret] = useState("");
  const [showRzpSecret, setShowRzpSecret] = useState(false);

  // Stripe
  const [stripePubKey, setStripePubKey] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [showStripeSecret, setShowStripeSecret] = useState(false);

  // WhatsApp Pay
  const [waPayConfigName, setWaPayConfigName] = useState("");

  // UPI Manual
  const [upiId, setUpiId] = useState("");
  const [merchantName, setMerchantName] = useState("");

  // Products Table
  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Add Product Dialog
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [newSku, setNewSku] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCurrency, setNewCurrency] = useState("USD");
  const [newDescription, setNewDescription] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    loadCommerceConfig();
    loadProducts();
  }, []);

  const loadCommerceConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/whatsapp/commerce/config");
      const data = await res.json();
      if (res.ok) {
        setCatalogId(data.catalog_id || "");
        setCatalogName(data.catalog_name || null);
        setCatalogConnectedAt(data.catalog_connected_at || null);
        setIsWhatsappConnected(!!data.is_whatsapp_connected);
        setPaymentProvider(data.payment_provider || "manual");
        setAutoPaymentLink(!!data.auto_create_payment_link);

        const pc = data.payment_config || {};
        if (pc.razorpay) {
          setRzpKeyId(pc.razorpay.key_id || "");
          setRzpKeySecret(pc.razorpay.key_secret || "");
        }
        if (pc.stripe) {
          setStripePubKey(pc.stripe.publishable_key || "");
          setStripeSecretKey(pc.stripe.secret_key || "");
        }
        if (pc.whatsapp_pay) {
          setWaPayConfigName(pc.whatsapp_pay.payment_configuration_name || "");
        }
        if (pc.upi_manual) {
          setUpiId(pc.upi_manual.upi_id || "");
          setMerchantName(pc.upi_manual.merchant_name || "");
        }
      }
    } catch {
      toast.error("Failed to load commerce configuration");
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
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

  const handleVerifyCatalog = async () => {
    if (!catalogId.trim()) {
      toast.error("Please enter a Meta Catalog ID");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/whatsapp/commerce/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalog_id: catalogId.trim(),
          test_catalog: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify catalog");
      setCatalogName(data.catalog_name);
      setCatalogConnectedAt(data.catalog_connected_at);
      toast.success("Meta Catalog verified successfully!");
      // Automatically sync products upon verification
      handleSyncProducts();
    } catch (err: any) {
      toast.error(err.message || "Catalog verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleSyncProducts = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/whatsapp/catalog/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast.success(data.message || `Synchronized ${data.synced} products.`);
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync products from Meta");
    } finally {
      setSyncing(false);
    }
  };

  const handleSavePaymentConfig = async () => {
    setSaving(true);
    try {
      const paymentConfigPayload: Record<string, any> = {};

      if (paymentProvider === "razorpay") {
        paymentConfigPayload.razorpay = {
          key_id: rzpKeyId.trim(),
          key_secret: rzpKeySecret.trim(),
        };
      } else if (paymentProvider === "stripe") {
        paymentConfigPayload.stripe = {
          publishable_key: stripePubKey.trim(),
          secret_key: stripeSecretKey.trim(),
        };
      } else if (paymentProvider === "whatsapp_pay") {
        paymentConfigPayload.whatsapp_pay = {
          payment_configuration_name: waPayConfigName.trim(),
        };
      } else if (paymentProvider === "upi_manual") {
        paymentConfigPayload.upi_manual = {
          upi_id: upiId.trim(),
          merchant_name: merchantName.trim(),
        };
      }

      const res = await fetch("/api/whatsapp/commerce/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_provider: paymentProvider,
          payment_config: paymentConfigPayload,
          auto_create_payment_link: autoPaymentLink,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save payment settings");
      toast.success("Payment settings updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save payment settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAddProduct = async () => {
    if (!newSku.trim() || !newName.trim() || !newPrice.trim()) {
      toast.error("SKU, Name, and Price are required");
      return;
    }
    setAddingProduct(true);
    try {
      const res = await fetch("/api/whatsapp/catalog/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retailer_id: newSku.trim(),
          name: newName.trim(),
          price: parseFloat(newPrice),
          currency: newCurrency,
          description: newDescription.trim() || undefined,
          image_url: newImageUrl.trim() || undefined,
          category: newCategory.trim() || undefined,
          sync_to_meta: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add product");
      toast.success("Product created in Meta Catalog & synced!");
      setAddProductOpen(false);
      // Reset form
      setNewSku("");
      setNewName("");
      setNewPrice("");
      setNewDescription("");
      setNewImageUrl("");
      setNewCategory("");
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Failed to add product");
    } finally {
      setAddingProduct(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.retailer_id.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <SettingsPanelHead
        title="Catalog & Payments"
        description="Connect your Meta Commerce Catalog, sync your products, and configure WhatsApp in-chat and link payments."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="catalog" className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Meta Catalog
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment Gateways
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: META CATALOG */}
        <TabsContent value="catalog" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Meta Commerce Catalog Integration</CardTitle>
                  <CardDescription className="text-xs">
                    Link your Meta Business Catalog to showcase products and receive cart orders directly in WhatsApp.
                  </CardDescription>
                </div>
                {catalogConnectedAt ? (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1.5 py-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1.5 py-1">
                    <XCircle className="h-3.5 w-3.5" />
                    Not Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="catalogId">Meta Catalog ID</Label>
                  <Input
                    id="catalogId"
                    placeholder="e.g. 104829103948102"
                    value={catalogId}
                    onChange={(e) => setCatalogId(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Found in{" "}
                    <a
                      href="https://business.facebook.com/commerce_manager"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Meta Commerce Manager
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>{" "}
                    under Catalog Settings.
                  </p>
                </div>

                <div className="flex items-end gap-2">
                  <Button
                    onClick={handleVerifyCatalog}
                    disabled={verifying || !catalogId.trim()}
                    className="w-full bg-primary"
                  >
                    {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Verify & Connect
                  </Button>
                </div>
              </div>

              {catalogName && (
                <div className="rounded-xl bg-muted/50 p-3.5 flex items-center justify-between border border-border">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Catalog Name: {catalogName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Linked at: {catalogConnectedAt ? new Date(catalogConnectedAt).toLocaleString() : "Recently"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSyncProducts}
                    disabled={syncing}
                    className="text-xs"
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                    Sync Products Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PRODUCTS CATALOG SECTION */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Product Catalog ({products.length})</CardTitle>
                  <CardDescription className="text-xs">
                    Products synced from Meta Catalog. Available in the inbox for 1-click sharing.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSyncProducts}
                    disabled={syncing}
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                    Sync from Meta
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setAddProductOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Product
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter products by name, SKU, or category..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>

              {loadingProducts ? (
                <div className="flex h-36 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  <Package className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                  <p className="font-medium text-foreground">No products in local catalog</p>
                  <p className="mt-1 text-xs">
                    Click &ldquo;Sync from Meta&rdquo; above to fetch your existing products, or click &ldquo;Add Product&rdquo; to create a new one.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/70 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-3.5 py-2.5">Product</th>
                        <th className="px-3.5 py-2.5">SKU / ID</th>
                        <th className="px-3.5 py-2.5">Category</th>
                        <th className="px-3.5 py-2.5">Price</th>
                        <th className="px-3.5 py-2.5">Availability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3.5 py-2.5">
                            <div className="flex items-center gap-2.5">
                              {p.image_url ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  className="h-9 w-9 rounded-lg object-cover bg-muted shrink-0"
                                />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                                  <Package className="h-4 w-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground truncate max-w-[200px]">{p.name}</p>
                                {p.description && (
                                  <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                    {p.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-[11px] text-muted-foreground">{p.retailer_id}</td>
                          <td className="px-3.5 py-2.5 text-muted-foreground">{p.category || "—"}</td>
                          <td className="px-3.5 py-2.5 font-bold text-foreground">
                            {p.currency} {Number(p.price).toFixed(2)}
                          </td>
                          <td className="px-3.5 py-2.5">
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: PAYMENTS */}
        <TabsContent value="payments" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Gateway Configuration</CardTitle>
              <CardDescription className="text-xs">
                Configure your preferred payment method for WhatsApp orders and in-chat checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Provider Selection Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* WhatsApp In-Chat Pay */}
                <div
                  onClick={() => setPaymentProvider("whatsapp_pay")}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    paymentProvider === "whatsapp_pay"
                      ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2">
                    <Zap className="h-5 w-5" />
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">WhatsApp Pay</h4>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Native in-chat Review & Pay (Meta Pay & WhatsApp UPI).
                  </p>
                </div>

                {/* Razorpay */}
                <div
                  onClick={() => setPaymentProvider("razorpay")}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    paymentProvider === "razorpay"
                      ? "border-sky-500 bg-sky-500/5 ring-1 ring-sky-500"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 mb-2">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">Razorpay</h4>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Automated payment link creation with UPI, Cards, Netbanking.
                  </p>
                </div>

                {/* Stripe */}
                <div
                  onClick={() => setPaymentProvider("stripe")}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    paymentProvider === "stripe"
                      ? "border-violet-500 bg-violet-500/5 ring-1 ring-violet-500"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 mb-2">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">Stripe</h4>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Global Checkout sessions with Cards, Apple Pay, Google Pay.
                  </p>
                </div>

                {/* UPI Manual */}
                <div
                  onClick={() => setPaymentProvider("upi_manual")}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    paymentProvider === "upi_manual"
                      ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-2">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">UPI / QR Code</h4>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Instant UPI deep link & QR code generation with zero fees.
                  </p>
                </div>
              </div>

              {/* DYNAMIC FORM PER PROVIDER */}
              {paymentProvider === "razorpay" && (
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-4">
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-sky-500" />
                    Razorpay Credentials
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="rzpKeyId" className="text-xs">Key ID</Label>
                      <Input
                        id="rzpKeyId"
                        placeholder="rzp_live_..."
                        value={rzpKeyId}
                        onChange={(e) => setRzpKeyId(e.target.value)}
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rzpSecret" className="text-xs">Key Secret</Label>
                      <div className="relative">
                        <Input
                          id="rzpSecret"
                          type={showRzpSecret ? "text" : "password"}
                          placeholder={MASKED}
                          value={rzpKeySecret}
                          onChange={(e) => setRzpKeySecret(e.target.value)}
                          className="text-xs font-mono pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRzpSecret(!showRzpSecret)}
                          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                          {showRzpSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {paymentProvider === "stripe" && (
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-4">
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-violet-500" />
                    Stripe Credentials
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="stripePubKey" className="text-xs">Publishable Key</Label>
                      <Input
                        id="stripePubKey"
                        placeholder="pk_live_..."
                        value={stripePubKey}
                        onChange={(e) => setStripePubKey(e.target.value)}
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="stripeSecret" className="text-xs">Secret Key</Label>
                      <div className="relative">
                        <Input
                          id="stripeSecret"
                          type={showStripeSecret ? "text" : "password"}
                          placeholder={MASKED}
                          value={stripeSecretKey}
                          onChange={(e) => setStripeSecretKey(e.target.value)}
                          className="text-xs font-mono pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowStripeSecret(!showStripeSecret)}
                          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                          {showStripeSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {paymentProvider === "whatsapp_pay" && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-4">
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-500" />
                    WhatsApp In-Chat Pay Configuration
                  </h4>
                  <div className="space-y-1.5">
                    <Label htmlFor="waConfigName" className="text-xs">Payment Configuration Name</Label>
                    <Input
                      id="waConfigName"
                      placeholder="e.g. payment_configuration_name"
                      value={waPayConfigName}
                      onChange={(e) => setWaPayConfigName(e.target.value)}
                      className="text-xs font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Configured under Meta WhatsApp Manager &rarr; Payment Configuration.
                    </p>
                  </div>
                </div>
              )}

              {paymentProvider === "upi_manual" && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-amber-500" />
                    UPI Details
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="upiId" className="text-xs">VPA / UPI ID</Label>
                      <Input
                        id="upiId"
                        placeholder="e.g. storename@okhdfcbank"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="merchantName" className="text-xs">Merchant / Payee Name</Label>
                      <Input
                        id="merchantName"
                        placeholder="e.g. Acme Store"
                        value={merchantName}
                        onChange={(e) => setMerchantName(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* AUTOMATION TOGGLE */}
              <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                <div className="space-y-0.5">
                  <Label htmlFor="autoPayment" className="text-sm font-medium">
                    Auto-Generate Payment Link
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically create and reply with a payment link whenever a customer sends a cart from WhatsApp.
                  </p>
                </div>
                <Switch
                  id="autoPayment"
                  checked={autoPaymentLink}
                  onCheckedChange={setAutoPaymentLink}
                />
              </div>

              {/* WEBHOOK URL HINT */}
              <div className="rounded-xl bg-muted/50 p-3.5 border border-border space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Payment Confirmation Webhook</p>
                <p className="text-[11px] text-muted-foreground">
                  Paste this endpoint into your Razorpay or Stripe dashboard to automatically mark orders as paid upon checkout:
                </p>
                <code className="block rounded bg-background px-2.5 py-1.5 text-[11px] font-mono text-primary border border-border">
                  {typeof window !== "undefined" ? window.location.origin : ""}/api/whatsapp/payments/webhook
                </code>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSavePaymentConfig} disabled={saving} className="bg-primary">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Save Payment Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ADD PRODUCT DIALOG */}
      <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Add Product to Meta Catalog
            </DialogTitle>
            <DialogDescription>
              This product will be created in your Meta Commerce Catalog and made available in WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">SKU / Retailer ID *</Label>
                <Input
                  placeholder="e.g. SKU-101"
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Input
                  placeholder="e.g. Electronics"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Product Name *</Label>
              <Input
                placeholder="e.g. Wireless Noise-Cancelling Headphones"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="29.99"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Input
                  placeholder="USD"
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
                  className="text-xs font-mono uppercase"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Image URL</Label>
              <Input
                placeholder="https://example.com/product.jpg"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                placeholder="Short description of the product..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProductOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddProduct}
              disabled={addingProduct}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {addingProduct ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

