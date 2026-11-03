"use client";

import { useEffect, useState } from "react";
import {
  ShoppingBag,
  Package,
  Layers,
  Store,
  Search,
  Check,
  Loader2,
  ExternalLink,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { CommerceProduct } from "@/types";

interface CatalogPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onSent?: () => void;
}

export function CatalogPickerDialog({
  open,
  onOpenChange,
  conversationId,
  onSent,
}: CatalogPickerDialogProps) {
  const [activeTab, setActiveTab] = useState<"single" | "collection" | "storefront">("single");
  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  // Single Product State
  const [selectedProduct, setSelectedProduct] = useState<CommerceProduct | null>(null);
  const [singleBody, setSingleBody] = useState("");
  const [singleFooter, setSingleFooter] = useState("");

  // Collection State
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [collectionHeader, setCollectionHeader] = useState("Recommended Products");
  const [collectionBody, setCollectionBody] = useState("Browse our curated items and place your order directly in WhatsApp.");
  const [collectionSectionTitle, setCollectionSectionTitle] = useState("Featured Items");

  // Storefront State
  const [storefrontBody, setStorefrontBody] = useState("Explore our complete product catalog and shop directly inside WhatsApp!");

  useEffect(() => {
    if (open) {
      fetchProducts();
    }
  }, [open]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/catalog/products?limit=100");
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
        if (data.products?.length > 0 && !selectedProduct) {
          setSelectedProduct(data.products[0]);
        }
      } else {
        toast.error(data.error || "Failed to load catalog products");
      }
    } catch {
      toast.error("Failed to fetch catalog products");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.retailer_id.toLowerCase().includes(search.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleProductSelection = (retailerId: string) => {
    if (selectedProductIds.includes(retailerId)) {
      setSelectedProductIds(selectedProductIds.filter((id) => id !== retailerId));
    } else {
      if (selectedProductIds.length >= 30) {
        toast.warning("Meta limits collections to 30 products maximum.");
        return;
      }
      setSelectedProductIds([...selectedProductIds, retailerId]);
    }
  };

  const handleSendSingle = async () => {
    if (!selectedProduct) {
      toast.error("Please select a product");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/catalog/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          catalog_kind: "product",
          product_retailer_id: selectedProduct.retailer_id,
          product_name: selectedProduct.name,
          product_price: selectedProduct.price,
          product_currency: selectedProduct.currency,
          body_text: singleBody.trim() || undefined,
          footer_text: singleFooter.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send product");
      toast.success("Product card sent to customer!");
      onOpenChange(false);
      onSent?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send product");
    } finally {
      setSending(false);
    }
  };

  const handleSendCollection = async () => {
    if (selectedProductIds.length === 0) {
      toast.error("Please select at least 1 product");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/catalog/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          catalog_kind: "product_list",
          header_text: collectionHeader.trim() || "Our Products",
          body_text: collectionBody.trim() || "Check out our collection:",
          sections: [
            {
              title: collectionSectionTitle.trim() || "Items",
              product_retailer_ids: selectedProductIds,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send product collection");
      toast.success("Product collection sent to customer!");
      onOpenChange(false);
      onSent?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send collection");
    } finally {
      setSending(false);
    }
  };

  const handleSendStorefront = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/catalog/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          catalog_kind: "catalog_message",
          body_text: storefrontBody.trim() || "Explore our catalog directly in WhatsApp!",
          product_retailer_id: products[0]?.retailer_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send catalog link");
      toast.success("Catalog link sent to customer!");
      onOpenChange(false);
      onSent?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send catalog storefront");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <ShoppingBag className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Send from WhatsApp Catalog
          </DialogTitle>
          <DialogDescription>
            Share products, collections, or your complete storefront with this customer.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="single" className="flex items-center gap-1.5 text-xs">
              <ShoppingBag className="h-3.5 w-3.5" />
              Single Product
            </TabsTrigger>
            <TabsTrigger value="collection" className="flex items-center gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" />
              Collection (MPM)
            </TabsTrigger>
            <TabsTrigger value="storefront" className="flex items-center gap-1.5 text-xs">
              <Store className="h-3.5 w-3.5" />
              Storefront Link
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: SINGLE PRODUCT */}
          <TabsContent value="single" className="space-y-4 pt-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products by name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            {loading ? (
              <div className="flex h-36 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No products found in your catalog. Go to Settings → Catalog & Payments to sync products from Meta.
              </div>
            ) : (
              <div className="grid max-h-52 grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-1">
                {filteredProducts.map((p) => {
                  const isSelected = selectedProduct?.retailer_id === p.retailer_id;
                  return (
                    <div
                      key={p.retailer_id}
                      onClick={() => setSelectedProduct(p)}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      {p.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-12 w-12 rounded-lg object-cover bg-muted shrink-0"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted shrink-0 text-muted-foreground">
                          <Package className="h-6 w-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">{p.name}</p>
                        <p className="text-[11px] font-bold text-primary">
                          {p.currency} {Number(p.price).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">SKU: {p.retailer_id}</p>
                      </div>
                      {isSelected && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedProduct && (
              <div className="rounded-xl bg-muted/40 p-3 space-y-2 border border-border">
                <p className="text-xs font-medium text-foreground">
                  Selected: <span className="font-bold">{selectedProduct.name}</span> ({selectedProduct.currency} {selectedProduct.price})
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Custom Note / Body (Optional)</Label>
                  <Input
                    placeholder="e.g. Here is the product you asked about!"
                    value={singleBody}
                    onChange={(e) => setSingleBody(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Footer Note (Optional)</Label>
                  <Input
                    placeholder="e.g. In stock with free 2-day delivery"
                    value={singleFooter}
                    onChange={(e) => setSingleFooter(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSendSingle}
                disabled={!selectedProduct || sending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingBag className="mr-2 h-4 w-4" />}
                Send Product Card
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* TAB 2: COLLECTION / MPM */}
          <TabsContent value="collection" className="space-y-4 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Collection Header</Label>
                <Input
                  value={collectionHeader}
                  onChange={(e) => setCollectionHeader(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Section Title</Label>
                <Input
                  value={collectionSectionTitle}
                  onChange={(e) => setCollectionSectionTitle(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Message Body</Label>
              <Input
                value={collectionBody}
                onChange={(e) => setCollectionBody(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Select Products ({selectedProductIds.length} selected)</Label>
                {selectedProductIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedProductIds([])}
                    className="h-6 text-[11px] text-muted-foreground"
                  >
                    Clear selection
                  </Button>
                )}
              </div>

              <div className="grid max-h-52 grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-1">
                {products.map((p) => {
                  const isChecked = selectedProductIds.includes(p.retailer_id);
                  return (
                    <div
                      key={p.retailer_id}
                      onClick={() => toggleProductSelection(p.retailer_id)}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 transition-all ${
                        isChecked
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isChecked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                        }`}
                      >
                        {isChecked && <Check className="h-3 w-3" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">{p.name}</p>
                        <p className="text-[11px] font-bold text-primary">
                          {p.currency} {Number(p.price).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSendCollection}
                disabled={selectedProductIds.length === 0 || sending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layers className="mr-2 h-4 w-4" />}
                Send Collection ({selectedProductIds.length})
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* TAB 3: STOREFRONT */}
          <TabsContent value="storefront" className="space-y-4 pt-3">
            <div className="rounded-2xl border border-border bg-gradient-to-br from-emerald-500/10 via-background to-teal-500/10 p-5 text-center">
              <Store className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400 mb-2" />
              <h3 className="font-bold text-foreground">WhatsApp Storefront Link</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                Sends an official WhatsApp interactive storefront card allowing the customer to view your entire catalog, add items to their WhatsApp cart, and submit orders directly to your CRM.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Message Prompt</Label>
              <Textarea
                rows={3}
                value={storefrontBody}
                onChange={(e) => setStorefrontBody(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSendStorefront}
                disabled={sending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Store className="mr-2 h-4 w-4" />}
                Send Storefront Link
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

