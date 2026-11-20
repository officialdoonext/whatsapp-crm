"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderTree,
  SlidersHorizontal,
  Package,
  Layers,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { parseProductsBuffer, type ParseProductsResult } from "@/lib/commerce/parse-products-file";

interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BulkUploadModal({ open, onOpenChange, onSuccess }: BulkUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseProductsResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);

  const resetState = () => {
    setSelectedFile(null);
    setParseResult(null);
    setImporting(false);
    setProgressMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setParsing(true);
    setParseResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const result = parseProductsBuffer(buffer);

      if (result.error) {
        toast.error(`File parsing warning: ${result.error}`);
      } else {
        toast.success(
          `Detected ${result.products.length} products across ${result.categoriesToCreate.length} categories!`
        );
      }
      setParseResult(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setParsing(false);
    }
  };

  const handleDownloadSample = (format: "xlsx" | "csv") => {
    const url = `/api/commerce/products/sample-excel?format=${format}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = format === "xlsx" ? "sample_products_50.xlsx" : "sample_products_50.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloading 50 master products sample (${format.toUpperCase()})`);
  };

  const handleImport = async () => {
    if (!selectedFile || !parseResult || parseResult.products.length === 0) {
      toast.error("Please choose a valid spreadsheet with product rows");
      return;
    }

    setImporting(true);
    setProgressMsg("Auto-creating missing categories and variants...");

    try {
      const res = await fetch("/api/commerce/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: parseResult.products,
          categoriesToCreate: parseResult.categoriesToCreate,
          variantsToCreate: parseResult.variantsToCreate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Bulk import failed");
      }

      toast.success(
        `Successfully imported ${data.importedCount} products! Created ${data.categoriesCreatedCount} categories and ${data.variantsCreatedCount} variants.`
      );

      resetState();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import products");
    } finally {
      setImporting(false);
      setProgressMsg(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!importing) {
          resetState();
          onOpenChange(v);
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border scrollbar-2px">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <FileSpreadsheet className="size-5 text-primary" />
            Bulk Import Products
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Upload an Excel (.xlsx, .xls) or CSV file with product records. Missing categories and variants are created automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Step 1: Sample File Download Banner */}
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileSpreadsheet className="size-4 text-primary" />
                Sample 50 Master Products Template
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Includes 50 pre-configured master products with variants, food types, tax, and nutrition data.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDownloadSample("xlsx")}
                className="gap-1.5 text-xs font-semibold bg-card hover:bg-muted"
              >
                <Download className="size-3.5 text-primary" />
                Excel (.xlsx)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDownloadSample("csv")}
                className="gap-1.5 text-xs font-semibold bg-card hover:bg-muted"
              >
                <Download className="size-3.5 text-muted-foreground" />
                CSV
              </Button>
            </div>
          </div>

          {/* Step 2: Dropzone File Upload */}
          <div
            onClick={() => !importing && fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${
              selectedFile
                ? "border-primary/50 bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Upload className="size-5" />
            </div>

            {selectedFile ? (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-bold text-foreground flex items-center justify-center gap-1.5">
                  <FileSpreadsheet className="size-4 text-emerald-500" />
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {Math.round(selectedFile.size / 1024)} KB • Click to choose another file
                </p>
              </div>
            ) : (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  Click or drag and drop your spreadsheet here
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Supports Microsoft Excel (.xlsx, .xls) and CSV files
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Step 3: Parsing / Inspection Feedback */}
          {parsing && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs font-medium text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              Inspecting spreadsheet rows, variants, and categories...
            </div>
          )}

          {parseResult && parseResult.products.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span className="text-xs font-bold text-foreground">
                    Spreadsheet Verified & Ready
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Package className="size-2.5" />
                    {parseResult.products.length} Products
                  </Badge>
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <FolderTree className="size-2.5" />
                    {parseResult.categoriesToCreate.length} Categories
                  </Badge>
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <SlidersHorizontal className="size-2.5" />
                    {parseResult.variantsToCreate.length} Variant Types
                  </Badge>
                </div>
              </div>

              {/* Preview Table of first 5 rows */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Preview of Detected Products (Showing first 5):
                </span>

                <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-3 py-1.5">Product Name</th>
                        <th className="px-3 py-1.5">Category</th>
                        <th className="px-3 py-1.5">Type</th>
                        <th className="px-3 py-1.5 text-right">Price</th>
                        <th className="px-3 py-1.5 text-right">Variants</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {parseResult.products.slice(0, 5).map((p, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-1.5 font-medium text-foreground truncate max-w-[160px]">
                            {p.name}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">{p.category || "—"}</td>
                          <td className="px-3 py-1.5">
                            {p.food_type === "veg" ? (
                              <span className="text-[10px] font-bold text-emerald-600">VEG</span>
                            ) : p.food_type === "non-veg" ? (
                              <span className="text-[10px] font-bold text-rose-600">NON-VEG</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">OTHERS</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-foreground">
                            ₹{p.sale_price || p.list_price}
                          </td>
                          <td className="px-3 py-1.5 text-right text-muted-foreground font-mono">
                            {p.variants_config.length > 0 ? `${p.variants_config.length} options` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-3">
          {progressMsg && (
            <div className="flex items-center gap-2 mr-auto text-xs font-semibold text-primary">
              <Loader2 className="size-3.5 animate-spin" />
              {progressMsg}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleImport}
            disabled={importing || !parseResult || parseResult.products.length === 0}
            className="gap-1.5 font-semibold"
          >
            {importing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${parseResult?.products.length || 0} Products`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
