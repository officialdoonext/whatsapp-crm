"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Tag,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  AlertCircle,
  FileText,
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
import type { CommerceProductType } from "@/types";

const PAGE_SIZE = 24;

export default function ProductTypesPage() {
  const [productTypes, setProductTypes] = useState<CommerceProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Add / Edit Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<CommerceProductType | null>(null);
  const [typeName, setTypeName] = useState("");
  const [typeDescription, setTypeDescription] = useState("");

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProductTypes = useCallback(async (targetPage = 1, searchQuery = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: PAGE_SIZE.toString(),
      });
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const res = await fetch(`/api/commerce/product-types?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load product types");
      }

      setProductTypes(data.productTypes || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || targetPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load product types");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchProductTypes(page, search);
  }, [page, fetchProductTypes, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProductTypes(1, search);
  };

  const handleOpenAdd = () => {
    setEditingType(null);
    setTypeName("");
    setTypeDescription("");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (pt: CommerceProductType) => {
    setEditingType(pt);
    setTypeName(pt.name);
    setTypeDescription(pt.description || "");
    setIsDialogOpen(true);
  };

  const handleSaveProductType = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = typeName.trim();
    if (!trimmed) {
      toast.error("Please enter a product type name");
      return;
    }

    setSaving(true);
    try {
      if (editingType) {
        const res = await fetch("/api/commerce/product-types", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingType.id,
            name: trimmed,
            description: typeDescription.trim() || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update product type");
        toast.success("Product type updated successfully");
      } else {
        const res = await fetch("/api/commerce/product-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            description: typeDescription.trim() || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create product type");
        toast.success("Product type created successfully");
      }

      setIsDialogOpen(false);
      fetchProductTypes(page, search);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product type");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProductType = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/commerce/product-types?id=${deleteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete product type");

      toast.success("Product type removed");
      setDeleteId(null);
      fetchProductTypes(page, search);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product type");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Tag className="size-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Product Types
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Create and manage product types (e.g. Veg, Non-Veg, Beverages, Electronics, Clothing) to categorize items.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchProductTypes(page, search)}
            disabled={loading}
            className="gap-1.5 font-semibold shadow-xs"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="gap-1.5 font-semibold shadow-xs"
          >
            <Plus className="size-4" />
            Add Product Type
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search product types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </form>

        <div className="text-xs text-muted-foreground">
          Total <span className="font-semibold text-foreground">{total} types</span> found
        </div>
      </div>

      {/* Grid of Product Types */}
      {loading && productTypes.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50">
          <Loader2 className="size-7 animate-spin text-primary" />
          <p className="text-xs font-semibold text-muted-foreground">Loading product types...</p>
        </div>
      ) : productTypes.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Tag className="size-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-foreground">No product types found</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {search
              ? "No types match your search query. Try clearing the filter."
              : "Get started by adding your first product type such as Veg, Non-Veg, or Grocery."}
          </p>
          <Button size="sm" onClick={handleOpenAdd} className="mt-4 gap-1.5 font-semibold">
            <Plus className="size-4" />
            Add First Product Type
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {productTypes.map((pt) => (
            <Card
              key={pt.id}
              className="group relative overflow-hidden transition-all duration-200 hover:border-primary/50 hover:shadow-md"
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-2.5 rounded-full bg-primary ring-2 ring-primary/20" />
                    <CardTitle className="text-sm font-bold text-foreground truncate" title={pt.name}>
                      {pt.name}
                    </CardTitle>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(pt)}
                      className="size-7 rounded-md bg-muted/80 text-muted-foreground hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
                      title="Edit type"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(pt.id)}
                      className="size-7 rounded-md bg-muted/80 text-muted-foreground hover:bg-destructive hover:text-white flex items-center justify-center transition-colors"
                      title="Delete type"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                <CardDescription className="line-clamp-2 text-xs mt-1 min-h-[2.5rem]">
                  {pt.description || "No description provided."}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-mono text-[10px] text-muted-foreground">
                  slug: {pt.slug || pt.name.toLowerCase().replace(/\s+/g, "-")}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {new Date(pt.created_at).toLocaleDateString()}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Page <span className="font-semibold text-foreground">{page}</span> of{" "}
            <span className="font-semibold text-foreground">{totalPages}</span>
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

      {/* Add / Edit Product Type Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Tag className="size-4 text-primary" />
              {editingType ? "Edit Product Type" : "Add Product Type"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define a product classification (e.g. Veg, Non-Veg, Beverages, Electronics, Clothing).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProductType} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Type Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Beverages or Electronics"
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
                required
                autoFocus
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Description (Optional)</label>
              <textarea
                rows={3}
                placeholder="Brief summary of items falling under this type..."
                value={typeDescription}
                onChange={(e) => setTypeDescription(e.target.value)}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="gap-1.5 font-semibold">
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                {editingType ? "Save Changes" : "Save Type"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-destructive">
              <AlertCircle className="size-4" />
              Delete Product Type?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete this product type? Existing products assigned to this type will keep their label.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2 border-t border-border">
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
              onClick={handleDeleteProductType}
              disabled={deleting}
              className="gap-1.5 font-semibold"
            >
              {deleting && <Loader2 className="size-3.5 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
