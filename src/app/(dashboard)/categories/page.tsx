"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FolderTree,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
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
import type { CommerceCategory } from "@/types";

const PAGE_SIZE = 24;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CommerceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Add Category dialog state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");

  // Delete confirmation dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = useCallback(async (targetPage = 1, searchQuery = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: PAGE_SIZE.toString(),
      });
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const res = await fetch(`/api/commerce/categories?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load categories");
      }

      setCategories(data.categories || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || targetPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCategories(page, search);
  }, [page, fetchCategories, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCategories(1, search);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = categoryName.trim();
    if (!trimmed) {
      toast.error("Please enter a category name");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/commerce/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: categoryDescription.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save category");
      }

      toast.success(`Category "${trimmed}" created successfully`);
      setIsAddOpen(false);
      setCategoryName("");
      setCategoryDescription("");
      setPage(1);
      fetchCategories(1, search);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/commerce/categories?id=${deleteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete category");
      }

      toast.success("Category deleted");
      setDeleteId(null);
      fetchCategories(page, search);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category");
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
              <FolderTree className="size-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Categories</h1>
            <Badge variant="outline" className="text-xs font-semibold">
              {total} {total === 1 ? "category" : "categories"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Group and structure your products into catalog categories for seamless WhatsApp storefront browsing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCategories(page, search)}
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
            Add Category
          </Button>
        </div>
      </div>

      {/* Search Bar & Stats */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search categories..."
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
      {loading && categories.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading categories...</p>
        </div>
      ) : categories.length === 0 ? (
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
              <FolderTree className="size-7" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              {search ? "No matching categories" : "No categories yet"}
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              {search
                ? `No categories match "${search}". Try searching for another term.`
                : "Create your first category to start organizing your WhatsApp product catalog."}
            </p>
            {!search && (
              <Button
                onClick={() => setIsAddOpen(true)}
                size="sm"
                className="mt-5 gap-1.5 font-semibold"
              >
                <Plus className="size-4" />
                Add Category
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((cat) => (
            <Card
              key={cat.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FolderTree className="size-4" />
                    </div>
                    <div className="truncate">
                      <CardTitle className="truncate text-base font-semibold text-foreground" title={cat.name}>
                        {cat.name}
                      </CardTitle>
                      {cat.slug && (
                        <p className="truncate font-mono text-[11px] text-muted-foreground/80">
                          /{cat.slug}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(cat.id)}
                    className="size-7 text-muted-foreground opacity-60 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    title="Delete category"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0 text-xs">
                <p className="line-clamp-2 min-h-[32px] text-muted-foreground">
                  {cat.description || "No description provided."}
                </p>

                <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    {new Date(cat.created_at).toLocaleDateString(undefined, {
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
            <span className="font-medium text-foreground">{total}</span> categories
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

      {/* Add Category Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <FolderTree className="size-5 text-primary" />
              Add Category
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter the category name to classify products in your catalog.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCategory} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="category-name" className="text-xs font-semibold text-foreground">
                Category Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="category-name"
                type="text"
                placeholder="e.g. Footwear, Electronics, Home Decor"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                autoFocus
                required
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="category-desc" className="text-xs font-semibold text-foreground">
                Description <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
              </label>
              <Input
                id="category-desc"
                type="text"
                placeholder="Brief summary of items in this category"
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
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
                  "Save Category"
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
              Delete Category
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete this category? This action cannot be undone.
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
              onClick={handleDeleteCategory}
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
