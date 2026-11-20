"use client";

import { useEffect, useState, useCallback } from "react";
import {
  SlidersHorizontal,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { CommerceVariant } from "@/types";

const PAGE_SIZE = 24;

export default function VariantsPage() {
  const [variants, setVariants] = useState<CommerceVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Add Variant dialog state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [variantLabel, setVariantLabel] = useState("");
  const [variantOptionsInput, setVariantOptionsInput] = useState("");
  const [variantDescription, setVariantDescription] = useState("");

  // Delete confirmation dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchVariants = useCallback(async (targetPage = 1, searchQuery = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: PAGE_SIZE.toString(),
      });
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const res = await fetch(`/api/commerce/variants?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load variants");
      }

      setVariants(data.variants || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || targetPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load variants");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchVariants(page, search);
  }, [page, fetchVariants, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchVariants(1, search);
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLabel = variantLabel.trim();
    if (!trimmedLabel) {
      toast.error("Please enter a variant label");
      return;
    }

    // Split options by comma
    const options = variantOptionsInput
      .split(",")
      .map((opt) => opt.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const res = await fetch("/api/commerce/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: trimmedLabel,
          options,
          description: variantDescription.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save variant");
      }

      toast.success(`Variant "${trimmedLabel}" created successfully`);
      setIsAddOpen(false);
      setVariantLabel("");
      setVariantOptionsInput("");
      setVariantDescription("");
      setPage(1);
      fetchVariants(1, search);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save variant");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariant = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/commerce/variants?id=${deleteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete variant");
      }

      toast.success("Variant deleted");
      setDeleteId(null);
      fetchVariants(page, search);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete variant");
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
              <SlidersHorizontal className="size-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Variants</h1>
            <Badge variant="outline" className="text-xs font-semibold">
              {total} {total === 1 ? "variant" : "variants"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure reusable variant attributes (such as Size, Color, Material) for your catalog products.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchVariants(page, search)}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="gap-1.5 font-semibold shadow-xs"
          >
            <Plus className="size-4" />
            Add Variant
          </Button>
        </div>
      </div>

      {/* Search Bar & Stats */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search variants by label..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </form>

        <div className="text-xs text-muted-foreground">
          Showing latest <span className="font-semibold text-foreground">24 items</span> per page
        </div>
      </div>

      {/* Main Content List */}
      {loading && variants.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading variants...</p>
        </div>
      ) : variants.length === 0 ? (
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
              <SlidersHorizontal className="size-7" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              {search ? "No matching variants" : "No variants yet"}
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              {search
                ? `No variants match "${search}". Try searching for another label.`
                : "Create your first variant attribute (e.g. Size, Color, Material) to configure product options."}
            </p>
            {!search && (
              <Button
                onClick={() => setIsAddOpen(true)}
                size="sm"
                className="mt-5 gap-1.5 font-semibold"
              >
                <Plus className="size-4" />
                Add Variant
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {variants.map((variant) => (
            <Card
              key={variant.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <SlidersHorizontal className="size-4" />
                    </div>
                    <div className="truncate">
                      <CardTitle className="truncate text-base font-semibold text-foreground" title={variant.label}>
                        {variant.label}
                      </CardTitle>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {variant.options && variant.options.length > 0
                          ? `${variant.options.length} ${variant.options.length === 1 ? "value" : "values"}`
                          : "No pre-set values"}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(variant.id)}
                    className="size-7 text-muted-foreground opacity-60 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    title="Delete variant"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0 text-xs">
                {/* Options Chips */}
                {variant.options && variant.options.length > 0 ? (
                  <div className="flex flex-wrap gap-1 min-h-[32px]">
                    {variant.options.slice(0, 6).map((opt, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="rounded-md border border-border/60 bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-foreground"
                      >
                        {opt}
                      </Badge>
                    ))}
                    {variant.options.length > 6 && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        +{variant.options.length - 6} more
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="line-clamp-2 min-h-[32px] text-muted-foreground">
                    {variant.description || "No specific values listed."}
                  </p>
                )}

                <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    {new Date(variant.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium uppercase">
                    Active
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{startItem}</span> to{" "}
            <span className="font-medium text-foreground">{endItem}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span> variants
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

      {/* Add Variant Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <SlidersHorizontal className="size-5 text-primary" />
              Add Variant
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter the variant label and optional option values (e.g. Size, Color, Material).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveVariant} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="variant-label" className="text-xs font-semibold text-foreground">
                Variant Label <span className="text-destructive">*</span>
              </label>
              <Input
                id="variant-label"
                type="text"
                placeholder="e.g. Size, Color, Material, Weight"
                value={variantLabel}
                onChange={(e) => setVariantLabel(e.target.value)}
                autoFocus
                required
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="variant-options" className="text-xs font-semibold text-foreground">
                Option Values <span className="text-xs font-normal text-muted-foreground">(comma-separated)</span>
              </label>
              <Input
                id="variant-options"
                type="text"
                placeholder="e.g. Small, Medium, Large, XL or Red, Blue, Black"
                value={variantOptionsInput}
                onChange={(e) => setVariantOptionsInput(e.target.value)}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Separate multiple choices with commas to automatically generate value pills.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="variant-desc" className="text-xs font-semibold text-foreground">
                Description <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
              </label>
              <Input
                id="variant-desc"
                type="text"
                placeholder="Optional notes or details for this variant"
                value={variantDescription}
                onChange={(e) => setVariantDescription(e.target.value)}
                className="text-sm"
              />
            </div>

            <DialogFooter className="mt-4 gap-2 pt-2">
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
                    Saving...
                  </>
                ) : (
                  "Save Variant"
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
              Delete Variant
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete this variant? This action cannot be undone.
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
              onClick={handleDeleteVariant}
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
