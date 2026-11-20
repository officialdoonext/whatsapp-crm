"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import {
  Layers,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Upload,
  X,
  SlidersHorizontal,
  DollarSign,
  Percent,
  Apple,
  UtensilsCrossed,
  Tag,
  Sparkles,
  CheckCircle2,
  FileText,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { compressImageTo80KB } from "@/lib/media/compress-image";
import type { CommerceVariant, ProductVariantItem, NutritionRow, TaxConfig } from "@/types";

const PAGE_SIZE = 24;

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [foodTypeFilter, setFoodTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Available variant templates for "Add Variant" picker
  const [availableVariants, setAvailableVariants] = useState<CommerceVariant[]>([]);

  // Add Product modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [description, setDescription] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [foodType, setFoodType] = useState<"veg" | "non-veg" | "others">("veg");

  // Tax state
  const [taxInclusive, setTaxInclusive] = useState(true);
  const [taxPercentage, setTaxPercentage] = useState("18");
  const [cgstPercentage, setCgstPercentage] = useState("9");
  const [sgstPercentage, setSgstPercentage] = useState("9");

  // Variants in product
  const [productVariants, setProductVariants] = useState<ProductVariantItem[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [variantValue, setVariantValue] = useState("");
  const [variantListPrice, setVariantListPrice] = useState("");
  const [variantSalePrice, setVariantSalePrice] = useState("");

  // Nutrition rows (optional)
  const [showNutrition, setShowNutrition] = useState(false);
  const [nutritionRows, setNutritionRows] = useState<NutritionRow[]>([
    { heading: "Energy", composition: "" },
    { heading: "Protein", composition: "" },
  ]);

  // Image uploads state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; preview: string; size: number }[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch product list
  const fetchProducts = useCallback(async (targetPage = 1, searchQuery = search, typeFilter = foodTypeFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: PAGE_SIZE.toString(),
      });
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      if (typeFilter && typeFilter !== "all") {
        params.set("food_type", typeFilter);
      }

      const res = await fetch(`/api/commerce/products?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load products");
      }

      setProducts(data.products || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || targetPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [search, foodTypeFilter]);

  // Load available variants templates
  const fetchVariantTemplates = async () => {
    try {
      const res = await fetch("/api/commerce/variants?limit=100");
      const data = await res.json();
      if (res.ok && data.variants) {
        setAvailableVariants(data.variants);
        if (data.variants.length > 0 && !selectedVariantId) {
          setSelectedVariantId(data.variants[0].id);
        }
      }
    } catch {
      // quiet
    }
  };

  useEffect(() => {
    fetchProducts(page, search, foodTypeFilter);
  }, [page, fetchProducts, search, foodTypeFilter]);

  useEffect(() => {
    if (isAddOpen) {
      fetchVariantTemplates();
    }
  }, [isAddOpen]);

  // Sync CGST & SGST when total tax percentage changes
  const handleTaxChange = (val: string) => {
    setTaxPercentage(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      const half = (num / 2).toFixed(2).replace(/\.00$/, "");
      setCgstPercentage(half);
      setSgstPercentage(half);
    }
  };

  // Add variant item into product
  const handleAddVariantToProduct = () => {
    const template = availableVariants.find((v) => v.id === selectedVariantId);
    const label = template ? template.label : "Custom";
    const val = variantValue.trim();

    if (!val) {
      toast.error("Please enter a variant value (e.g. Small, Medium, Red, Blue)");
      return;
    }

    const vListPrice = parseFloat(variantListPrice) || parseFloat(listPrice) || 0;
    const vSalePrice = parseFloat(variantSalePrice) || parseFloat(salePrice) || vListPrice;

    const newItem: ProductVariantItem = {
      id: Math.random().toString(36).substring(7),
      variant_id: template?.id,
      variant_label: label,
      value: val,
      list_price: vListPrice,
      sale_price: vSalePrice,
    };

    setProductVariants([...productVariants, newItem]);
    setVariantValue("");
    setVariantListPrice("");
    setVariantSalePrice("");
  };

  const handleRemoveVariant = (index: number) => {
    setProductVariants(productVariants.filter((_, i) => i !== index));
  };

  // Nutrition table handlers
  const handleAddNutritionRow = () => {
    setNutritionRows([...nutritionRows, { heading: "", composition: "" }]);
  };

  const handleUpdateNutritionRow = (index: number, field: "heading" | "composition", val: string) => {
    const updated = [...nutritionRows];
    updated[index][field] = val;
    setNutritionRows(updated);
  };

  const handleRemoveNutritionRow = (index: number) => {
    setNutritionRows(nutritionRows.filter((_, i) => i !== index));
  };

  // Image selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newItems = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      size: file.size,
    }));
    setSelectedFiles((prev) => [...prev, ...newItems]);
  };

  const handleRemoveSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Save product flow
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = productName.trim();
    if (!trimmedName) {
      toast.error("Product name is required");
      return;
    }

    setSaving(true);
    setUploadProgress("Optimizing and compressing images to ≤80KB...");

    try {
      const uploadedUrls: string[] = [...existingImages];

      // 1. Process each selected image: Compress to <= 80KB then upload to ImageKit/Cloudinary
      for (let i = 0; i < selectedFiles.length; i++) {
        const item = selectedFiles[i];
        setUploadProgress(`Compressing image ${i + 1} of ${selectedFiles.length} to ≤80KB...`);

        // Compress image to 80KB without losing quality
        const compressedFile = await compressImageTo80KB(item.file);

        setUploadProgress(
          `Uploading image ${i + 1} (${Math.round(compressedFile.size / 1024)}KB) to storage...`
        );

        const formData = new FormData();
        formData.append("file", compressedFile);
        formData.append("fileName", compressedFile.name);
        formData.append("fileType", "images");

        const uploadRes = await fetch("/api/storage/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.url) {
          uploadedUrls.push(uploadData.url);
        } else {
          console.warn("Image upload failed, using preview data:", uploadData);
          uploadedUrls.push(item.preview);
        }
      }

      setUploadProgress("Saving product record...");

      // 2. Prepare payload
      const payload = {
        name: trimmedName,
        short_code: shortCode.trim() || undefined,
        description: description.trim() || undefined,
        list_price: parseFloat(listPrice) || 0,
        sale_price: parseFloat(salePrice) || parseFloat(listPrice) || 0,
        food_type: foodType,
        tax_config: {
          inclusive: taxInclusive,
          tax_percentage: parseFloat(taxPercentage) || 0,
          cgst: parseFloat(cgstPercentage) || 0,
          sgst: parseFloat(sgstPercentage) || 0,
        },
        variants_config: productVariants,
        nutrition_table: showNutrition
          ? nutritionRows.filter((r) => r.heading.trim() && r.composition.trim())
          : [],
        images: uploadedUrls,
      };

      const res = await fetch("/api/commerce/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save product");
      }

      toast.success(`Product "${trimmedName}" saved successfully!`);
      setIsAddOpen(false);
      resetForm();
      fetchProducts(1, search, foodTypeFilter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const resetForm = () => {
    setProductName("");
    setShortCode("");
    setDescription("");
    setListPrice("");
    setSalePrice("");
    setFoodType("veg");
    setTaxInclusive(true);
    setProductVariants([]);
    setSelectedFiles([]);
    setExistingImages([]);
    setNutritionRows([
      { heading: "Energy", composition: "" },
      { heading: "Protein", composition: "" },
    ]);
  };

  const handleDeleteProduct = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/commerce/products?id=${deleteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete product");
      }
      toast.success("Product deleted");
      setDeleteId(null);
      fetchProducts(page, search, foodTypeFilter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product");
    } finally {
      setDeleting(false);
    }
  };

  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="size-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Products</h1>
            <Badge variant="outline" className="text-xs font-semibold">
              {total} {total === 1 ? "product" : "products"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your store catalog with multi-variant options, food types, tax calculations, and 80KB optimized media.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchProducts(page, search, foodTypeFilter)}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setIsAddOpen(true);
            }}
            className="gap-1.5 font-semibold shadow-xs"
          >
            <Plus className="size-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2.5 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name or short code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setFoodTypeFilter("all");
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                foodTypeFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => {
                setFoodTypeFilter("veg");
                setPage(1);
              }}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                foodTypeFilter === "veg"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "border border-border bg-card text-emerald-600 hover:bg-emerald-500/10"
              }`}
            >
              <span className="size-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
              Veg
            </button>
            <button
              type="button"
              onClick={() => {
                setFoodTypeFilter("non-veg");
                setPage(1);
              }}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                foodTypeFilter === "non-veg"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "border border-border bg-card text-rose-600 hover:bg-rose-500/10"
              }`}
            >
              <span className="size-1.5 rounded-full bg-rose-500 ring-2 ring-rose-500/30" />
              Non-Veg
            </button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Showing latest <span className="font-semibold text-foreground">24 items</span> per page
        </div>
      </div>

      {/* Product List Grid */}
      {loading && products.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading products...</p>
        </div>
      ) : products.length === 0 ? (
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
              <Layers className="size-7" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              {search ? "No matching products" : "No products added yet"}
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              {search
                ? `No products match "${search}". Try searching for another name or code.`
                : "Create your first product with prices, variants, food types, and optimized photos."}
            </p>
            {!search && (
              <Button
                onClick={() => {
                  resetForm();
                  setIsAddOpen(true);
                }}
                size="sm"
                className="mt-5 gap-1.5 font-semibold"
              >
                <Plus className="size-4" />
                Add Product
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => {
            const hasDiscount = p.list_price > p.sale_price && p.sale_price > 0;
            const primaryImg = p.images?.[0] || p.image_url;
            const variantsCount = p.variants_config?.length || p.metadata?.variants?.length || 0;

            return (
              <Card
                key={p.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
              >
                {/* Product Image Header */}
                <div className="relative aspect-4/3 w-full overflow-hidden bg-muted/40">
                  {primaryImg ? (
                    <img
                      src={primaryImg}
                      alt={p.name}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <Layers className="size-8 stroke-[1.5]" />
                      <span className="text-[10px] font-medium">No image</span>
                    </div>
                  )}

                  {/* Food Type Badge */}
                  <div className="absolute left-2.5 top-2.5">
                    {p.food_type === "veg" ? (
                      <span className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-card/90 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 shadow-xs backdrop-blur-xs">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        VEG
                      </span>
                    ) : p.food_type === "non-veg" ? (
                      <span className="flex items-center gap-1 rounded-md border border-rose-500/40 bg-card/90 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 shadow-xs backdrop-blur-xs">
                        <span className="size-2 rounded-full bg-rose-500" />
                        NON-VEG
                      </span>
                    ) : null}
                  </div>

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(p.id)}
                    className="absolute right-2 top-2 size-7 rounded-lg bg-card/80 text-muted-foreground opacity-0 shadow-xs backdrop-blur-xs transition-all hover:bg-destructive hover:text-white group-hover:opacity-100"
                    title="Delete product"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {/* Details */}
                <CardContent className="space-y-3 p-3.5">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="truncate font-semibold text-foreground text-sm" title={p.name}>
                        {p.name}
                      </h3>
                      {p.short_code && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {p.short_code}
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                  </div>

                  {/* Price & Variants */}
                  <div className="flex items-baseline justify-between border-t border-border/60 pt-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-foreground">
                        ₹{Number(p.sale_price || p.price || 0).toFixed(2)}
                      </span>
                      {hasDiscount && (
                        <span className="text-xs text-muted-foreground line-through">
                          ₹{Number(p.list_price).toFixed(2)}
                        </span>
                      )}
                    </div>

                    {variantsCount > 0 && (
                      <Badge variant="secondary" className="gap-1 text-[10px] font-semibold">
                        <SlidersHorizontal className="size-2.5" />
                        {variantsCount} {variantsCount === 1 ? "variant" : "variants"}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{startItem}</span> to{" "}
            <span className="font-medium text-foreground">{endItem}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span> products
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1 || loading}
              className="gap-1 text-xs"
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </Button>

            <span className="px-2 text-xs font-semibold text-muted-foreground">
              Page {page} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages || loading}
              className="gap-1 text-xs"
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Comprehensive Add Product Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto bg-card border-border scrollbar-2px">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Layers className="size-5 text-primary" />
              Add New Product
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure product info, multi-variant pricing, tax, nutrition tables, and 80KB optimized media.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProduct} className="space-y-6 py-2">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Product Details (7 cols) */}
              <div className="space-y-4 lg:col-span-7">
                {/* Title & Short Code */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-foreground">
                      Product Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. Classic Margherita Pizza"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      required
                      autoFocus
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Short Code / SKU
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. PIZZA-MARG"
                      value={shortCode}
                      onChange={(e) => setShortCode(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Enter short description for WhatsApp cart customers..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                {/* Food Type Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Food Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFoodType("veg")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-semibold transition-all cursor-pointer ${
                        foodType === "veg"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-xs"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Veg
                    </button>

                    <button
                      type="button"
                      onClick={() => setFoodType("non-veg")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-semibold transition-all cursor-pointer ${
                        foodType === "non-veg"
                          ? "border-rose-500 bg-rose-500/10 text-rose-600 shadow-xs"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="size-2 rounded-full bg-rose-500" />
                      Non-Veg
                    </button>

                    <button
                      type="button"
                      onClick={() => setFoodType("others")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-semibold transition-all cursor-pointer ${
                        foodType === "others"
                          ? "border-primary bg-primary/10 text-primary shadow-xs"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Others
                    </button>
                  </div>
                </div>

                {/* Pricing: List Price & Sale Price */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      List Price (MRP)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="299.00"
                        value={listPrice}
                        onChange={(e) => setListPrice(e.target.value)}
                        className="pl-7 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Sale Price <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="249.00"
                        value={salePrice}
                        onChange={(e) => setSalePrice(e.target.value)}
                        required
                        className="pl-7 text-sm font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Tax Configuration */}
                <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">Tax Settings</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTaxInclusive(true)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                          taxInclusive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Inclusive
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaxInclusive(false)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                          !taxInclusive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Exclusive
                      </button>
                    </div>
                  </div>

                  {!taxInclusive && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60">
                      <div>
                        <span className="text-[10px] text-muted-foreground">Tax %</span>
                        <Input
                          type="number"
                          value={taxPercentage}
                          onChange={(e) => handleTaxChange(e.target.value)}
                          className="h-8 text-xs font-mono"
                          placeholder="18"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground">CGST %</span>
                        <Input
                          type="number"
                          value={cgstPercentage}
                          onChange={(e) => setCgstPercentage(e.target.value)}
                          className="h-8 text-xs font-mono"
                          placeholder="9"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground">SGST %</span>
                        <Input
                          type="number"
                          value={sgstPercentage}
                          onChange={(e) => setSgstPercentage(e.target.value)}
                          className="h-8 text-xs font-mono"
                          placeholder="9"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Product Variants Section */}
                <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">Variants & Options</h4>
                      <p className="text-[10px] text-muted-foreground">
                        Add size, color, or portion variants with custom list & sale prices.
                      </p>
                    </div>
                  </div>

                  {/* Add variant row controls */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <select
                      value={selectedVariantId}
                      onChange={(e) => setSelectedVariantId(e.target.value)}
                      className="rounded-md border border-input bg-card px-2 py-1.5 text-xs text-foreground shadow-xs"
                    >
                      {availableVariants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>

                    <Input
                      type="text"
                      placeholder="Value (e.g. Small / 500g)"
                      value={variantValue}
                      onChange={(e) => setVariantValue(e.target.value)}
                      className="h-8 text-xs"
                    />

                    <Input
                      type="number"
                      placeholder="Sale Price (₹)"
                      value={variantSalePrice}
                      onChange={(e) => setVariantSalePrice(e.target.value)}
                      className="h-8 text-xs"
                    />

                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddVariantToProduct}
                      className="h-8 gap-1 text-xs font-semibold"
                    >
                      <Plus className="size-3" />
                      Add Variant
                    </Button>
                  </div>

                  {/* List of configured variants */}
                  {productVariants.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {productVariants.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs shadow-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {item.variant_label}
                            </Badge>
                            <span className="font-semibold text-foreground">{item.value}</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-foreground">
                              ₹{Number(item.sale_price).toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveVariant(idx)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Nutrition Table (Optional) */}
                <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        Nutrition Table <span className="text-[10px] font-normal text-muted-foreground">(Optional)</span>
                      </h4>
                      <p className="text-[10px] text-muted-foreground">
                        Detailed nutritional breakdown (Energy, Protein, Carbs, Fats).
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNutrition(!showNutrition)}
                      className="h-7 text-[11px]"
                    >
                      {showNutrition ? "Hide" : "Add Nutrition Table"}
                    </Button>
                  </div>

                  {showNutrition && (
                    <div className="space-y-2 pt-2 border-t border-border/60">
                      {nutritionRows.map((row, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            placeholder="Heading (e.g. Protein)"
                            value={row.heading}
                            onChange={(e) => handleUpdateNutritionRow(idx, "heading", e.target.value)}
                            className="h-8 text-xs"
                          />
                          <Input
                            placeholder="Composition (e.g. 12g)"
                            value={row.composition}
                            onChange={(e) => handleUpdateNutritionRow(idx, "composition", e.target.value)}
                            className="h-8 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveNutritionRow(idx)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAddNutritionRow}
                        className="h-7 gap-1 text-[11px] text-primary"
                      >
                        <Plus className="size-3" /> Add Row
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Image Uploader & Previews (5 cols) */}
              <div className="space-y-4 lg:col-span-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">Product Images</label>

                  {/* Drop area */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 text-center transition-all cursor-pointer hover:border-primary/50 hover:bg-muted/30"
                  >
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Upload className="size-5" />
                    </div>
                    <p className="mt-2 text-xs font-semibold text-foreground">Click to choose images</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      PNG, JPG, WEBP • Multiple selection supported
                    </p>
                    <Badge variant="secondary" className="mt-2.5 text-[10px] font-semibold text-emerald-600">
                      Auto-compressed to ≤80KB without quality loss
                    </Badge>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {/* Previews Grid */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Selected ({selectedFiles.length})
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedFiles.map((item, idx) => (
                        <div
                          key={idx}
                          className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted/40 shadow-xs"
                        >
                          <img src={item.preview} alt="preview" className="size-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveSelectedFile(idx)}
                              className="size-6 rounded-full bg-destructive text-white flex items-center justify-center hover:scale-110 transition-transform"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.2 text-[9px] font-mono text-white">
                            {Math.round(item.size / 1024)}KB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Storage Provider Notice */}
                <div className="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Sparkles className="size-3.5 text-primary" />
                    Storage Integration
                  </div>
                  <p className="text-[11px]">
                    Images are compressed to strictly ≤80KB in your browser before upload, then stored on your configured ImageKit / Cloudinary integration.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <DialogFooter className="mt-6 gap-2 pt-3 border-t border-border">
              {uploadProgress && (
                <div className="flex items-center gap-2 mr-auto text-xs font-semibold text-primary">
                  <Loader2 className="size-3.5 animate-spin" />
                  {uploadProgress}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>

              <Button type="submit" size="sm" disabled={saving} className="gap-1.5 font-semibold">
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving Product...
                  </>
                ) : (
                  "Save Product"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive">
              Delete Product
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete this product? It will be removed from your store catalog.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteProduct}
              disabled={deleting}
              className="gap-1.5 font-semibold"
            >
              {deleting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
