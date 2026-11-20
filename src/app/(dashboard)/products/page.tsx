"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  Sparkles,
  CheckCircle2,
  FileText,
  AlertCircle,
  Eye,
  Pencil,
  Info,
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
import type { CommerceVariant, ProductVariantItem, NutritionRow, TaxConfig, StoreProduct } from "@/types";

const PAGE_SIZE = 24;

export default function ProductsPage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [foodTypeFilter, setFoodTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Available variant templates for "Add Variant" picker
  const [availableVariants, setAvailableVariants] = useState<CommerceVariant[]>([]);

  // Add / Edit Product modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
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

  // View Product modal state
  const [viewProduct, setViewProduct] = useState<StoreProduct | null>(null);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);

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

  const handleRemoveExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  // View Product handler
  const handleOpenView = (p: StoreProduct) => {
    setViewProduct(p);
    const imgs = p.images || [];
    setActivePreviewImage(imgs[0] || p.image_url || null);
  };

  // Start Edit handler
  const handleStartEdit = (p: StoreProduct) => {
    setEditingProductId(p.id);
    setProductName(p.name);
    setShortCode(p.short_code || "");
    setDescription(p.description || "");
    setListPrice(p.list_price ? String(p.list_price) : "");
    setSalePrice(p.sale_price ? String(p.sale_price) : "");
    setFoodType(p.food_type || "others");

    // Tax
    const tc = p.tax_config || { inclusive: true };
    setTaxInclusive(tc.inclusive ?? true);
    setTaxPercentage(tc.tax_percentage !== undefined ? String(tc.tax_percentage) : "18");
    setCgstPercentage(tc.cgst !== undefined ? String(tc.cgst) : "9");
    setSgstPercentage(tc.sgst !== undefined ? String(tc.sgst) : "9");

    // Variants
    const vars = p.variants_config || (Array.isArray(p.metadata?.variants) ? (p.metadata.variants as ProductVariantItem[]) : []);
    setProductVariants(vars || []);

    // Nutrition
    const nut = p.nutrition_table || (Array.isArray(p.metadata?.nutrition_table) ? (p.metadata.nutrition_table as NutritionRow[]) : []);
    if (nut && nut.length > 0) {
      setNutritionRows(nut);
      setShowNutrition(true);
    } else {
      setNutritionRows([
        { heading: "Energy", composition: "" },
        { heading: "Protein", composition: "" },
      ]);
      setShowNutrition(false);
    }

    // Images
    setExistingImages(p.images || (p.image_url ? [p.image_url] : []));
    setSelectedFiles([]);

    // Open editor dialog
    setIsAddOpen(true);
  };

  // Save product flow (Add or Edit)
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

      // 1. Process each new selected image: Compress to <= 80KB then upload to ImageKit/Cloudinary
      for (let i = 0; i < selectedFiles.length; i++) {
        const item = selectedFiles[i];
        setUploadProgress(`Compressing image ${i + 1} of ${selectedFiles.length} to ≤80KB...`);

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

      setUploadProgress(editingProductId ? "Updating product record..." : "Saving product record...");

      // 2. Prepare payload
      const payload = {
        id: editingProductId || undefined,
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

      const method = editingProductId ? "PUT" : "POST";
      const res = await fetch("/api/commerce/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save product");
      }

      toast.success(
        editingProductId
          ? `Product "${trimmedName}" updated successfully!`
          : `Product "${trimmedName}" created successfully!`
      );
      setIsAddOpen(false);
      resetForm();
      fetchProducts(page, search, foodTypeFilter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const resetForm = () => {
    setEditingProductId(null);
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
      if (viewProduct?.id === deleteId) {
        setViewProduct(null);
      }
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Store Products</h1>
            <Badge variant="outline" className="text-xs font-semibold">
              {total} {total === 1 ? "product" : "products"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your store items with multi-variant pricing, food types, tax calculations, and 80KB optimized media.
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
              {search ? "No matching products" : "No store products added yet"}
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
            const variantsCount =
              p.variants_config?.length ||
              (Array.isArray(p.metadata?.variants) ? p.metadata.variants.length : 0);

            return (
              <Card
                key={p.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
              >
                {/* Product Image Header */}
                <div
                  onClick={() => handleOpenView(p)}
                  className="relative aspect-4/3 w-full overflow-hidden bg-muted/40 cursor-pointer"
                >
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

                  {/* Quick Card Action Buttons */}
                  <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenView(p);
                      }}
                      className="size-7 rounded-lg bg-card/90 text-muted-foreground shadow-xs backdrop-blur-xs transition-all hover:bg-primary hover:text-white"
                      title="View product details"
                    >
                      <Eye className="size-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(p);
                      }}
                      className="size-7 rounded-lg bg-card/90 text-muted-foreground shadow-xs backdrop-blur-xs transition-all hover:bg-primary hover:text-white"
                      title="Edit product"
                    >
                      <Pencil className="size-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(p.id);
                      }}
                      className="size-7 rounded-lg bg-card/90 text-muted-foreground shadow-xs backdrop-blur-xs transition-all hover:bg-destructive hover:text-white"
                      title="Delete product"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Details */}
                <CardContent className="space-y-3 p-3.5">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <h3
                        onClick={() => handleOpenView(p)}
                        className="truncate font-semibold text-foreground text-sm cursor-pointer hover:text-primary transition-colors"
                        title={p.name}
                      >
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
                        ₹{Number(p.sale_price || p.list_price || 0).toFixed(2)}
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

      {/* View Product Details Dialog */}
      <Dialog open={!!viewProduct} onOpenChange={(open) => !open && setViewProduct(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border scrollbar-2px">
          {viewProduct && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-xl font-bold text-foreground">
                        {viewProduct.name}
                      </DialogTitle>
                      {viewProduct.food_type === "veg" ? (
                        <span className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                          <span className="size-2 rounded-full bg-emerald-500" />
                          VEG
                        </span>
                      ) : viewProduct.food_type === "non-veg" ? (
                        <span className="flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                          <span className="size-2 rounded-full bg-rose-500" />
                          NON-VEG
                        </span>
                      ) : null}
                    </div>

                    {viewProduct.short_code && (
                      <p className="font-mono text-xs text-muted-foreground">
                        SKU: <span className="text-foreground font-semibold">{viewProduct.short_code}</span>
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const p = viewProduct;
                      setViewProduct(null);
                      handleStartEdit(p);
                    }}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <Pencil className="size-3.5" />
                    Edit Product
                  </Button>
                </div>
              </DialogHeader>

              {/* Gallery Image Preview */}
              {viewProduct.images && viewProduct.images.length > 0 && (
                <div className="space-y-2">
                  <div className="relative aspect-16/9 w-full overflow-hidden rounded-xl border border-border bg-muted/30">
                    <img
                      src={activePreviewImage || viewProduct.images[0]}
                      alt={viewProduct.name}
                      className="size-full object-contain"
                    />
                  </div>

                  {viewProduct.images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-2px">
                      {viewProduct.images.map((imgUrl, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActivePreviewImage(imgUrl)}
                          className={`size-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all cursor-pointer ${
                            (activePreviewImage || viewProduct.images[0]) === imgUrl
                              ? "border-primary shadow-xs"
                              : "border-border opacity-70 hover:opacity-100"
                          }`}
                        >
                          <img src={imgUrl} alt="" className="size-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {viewProduct.description && (
                <div className="space-y-1 rounded-xl border border-border/70 bg-muted/20 p-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Description
                  </h4>
                  <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                    {viewProduct.description}
                  </p>
                </div>
              )}

              {/* Pricing & Tax Summary */}
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">Price</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xl font-bold text-foreground">
                      ₹{Number(viewProduct.sale_price || viewProduct.list_price || 0).toFixed(2)}
                    </span>
                    {viewProduct.list_price > viewProduct.sale_price && (
                      <span className="text-xs text-muted-foreground line-through">
                        ₹{Number(viewProduct.list_price).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">Tax</span>
                  <p className="mt-0.5 text-xs font-medium text-foreground">
                    {viewProduct.tax_config?.inclusive ? (
                      <span className="text-emerald-600 font-semibold">Tax Inclusive</span>
                    ) : (
                      <span>
                        Exclusive: {viewProduct.tax_config?.tax_percentage || 0}%{" "}
                        <span className="text-muted-foreground text-[11px]">
                          (CGST: {viewProduct.tax_config?.cgst || 0}%, SGST: {viewProduct.tax_config?.sgst || 0}%)
                        </span>
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Configured Variants */}
              {viewProduct.variants_config && viewProduct.variants_config.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Available Variants ({viewProduct.variants_config.length})
                  </h4>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Variant</th>
                          <th className="px-3 py-2">Value</th>
                          <th className="px-3 py-2 text-right">List Price</th>
                          <th className="px-3 py-2 text-right">Sale Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {viewProduct.variants_config.map((v, i) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="px-3 py-2 font-medium text-foreground">{v.variant_label}</td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="text-[10px]">
                                {v.value}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-right text-muted-foreground">
                              ₹{Number(v.list_price).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-foreground">
                              ₹{Number(v.sale_price).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Nutrition Information */}
              {viewProduct.nutrition_table && viewProduct.nutrition_table.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Nutritional Information
                  </h4>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Nutrient / Parameter</th>
                          <th className="px-3 py-2 text-right">Composition</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {viewProduct.nutrition_table.map((row, i) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="px-3 py-2 font-medium text-foreground">{row.heading}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground font-mono">
                              {row.composition}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <DialogFooter className="border-t border-border pt-3">
                <Button variant="outline" size="sm" onClick={() => setViewProduct(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Comprehensive Add / Edit Product Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto bg-card border-border scrollbar-2px">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              {editingProductId ? <Pencil className="size-5 text-primary" /> : <Layers className="size-5 text-primary" />}
              {editingProductId ? "Edit Product" : "Add New Product"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingProductId
                ? "Update product details, variant prices, tax, and photo gallery."
                : "Configure product info, multi-variant pricing, tax, nutrition tables, and 80KB optimized media."}
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

                {/* Previews Grid: Existing Images */}
                {existingImages.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Current Images ({existingImages.length})
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {existingImages.map((url, idx) => (
                        <div
                          key={idx}
                          className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted/40 shadow-xs"
                        >
                          <img src={url} alt="existing" className="size-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveExistingImage(idx)}
                              className="size-6 rounded-full bg-destructive text-white flex items-center justify-center hover:scale-110 transition-transform"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previews Grid: Newly Selected Files */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      New Images To Upload ({selectedFiles.length})
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
                    {editingProductId ? "Updating Product..." : "Saving Product..."}
                  </>
                ) : (
                  editingProductId ? "Save Changes" : "Save Product"
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
              Are you sure you want to delete this product? It will be permanently removed from your store catalog.
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
