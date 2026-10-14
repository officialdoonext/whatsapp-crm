"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Search,
  Download,
  MessageSquare,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Pencil,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface RunRow {
  id: string;
  status:
    | "active"
    | "completed"
    | "handed_off"
    | "timed_out"
    | "paused_by_agent"
    | "failed";
  current_node_key: string | null;
  started_at: string;
  last_advanced_at: string;
  ended_at: string | null;
  end_reason: string | null;
  vars: Record<string, unknown>;
  reprompt_count: number;
  contact: { id: string; name: string | null; phone: string } | null;
}

export default function FlowAnalyticsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const flowId = params?.id;

  const [flow, setFlow] = useState<{ id: string; name: string } | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "contacted">("all");
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchRuns = async () => {
    if (!flowId) return;
    try {
      const res = await fetch(`/api/flows/${flowId}/runs`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("Flow not found");
          router.push("/flows");
          return;
        }
        throw new Error(`Failed to load flow data: ${res.status}`);
      }
      const data = await res.json();
      setFlow(data.flow ?? null);
      setRuns(data.runs ?? []);
    } catch (err) {
      console.error("[flow-analytics] fetch failed:", err);
      toast.error("Failed to load flow analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [flowId]);

  // Lead status: defaults to 'new' if not set in vars.lead_status
  const getLeadStatus = (run: RunRow): "new" | "contacted" => {
    const raw = run.vars?.lead_status;
    if (raw === "contacted") return "contacted";
    return "new";
  };

  // Toggle or change lead status
  const handleStatusChange = async (runId: string, nextStatus: "new" | "contacted") => {
    setUpdatingId(runId);
    try {
      const res = await fetch(`/api/flows/${flowId}/runs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, lead_status: nextStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update status");
      }
      setRuns((prev) =>
        prev.map((r) =>
          r.id === runId ? { ...r, vars: { ...r.vars, lead_status: nextStatus } } : r
        )
      );
      toast.success(`Marked as ${nextStatus === "contacted" ? "Contacted" : "New"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  // Delete run
  const handleDeleteRun = async () => {
    if (!deleteRunId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/flows/${flowId}/runs?runId=${deleteRunId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete record");
      }
      setRuns((prev) => prev.filter((r) => r.id !== deleteRunId));
      toast.success("Record deleted successfully");
      setDeleteRunId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete record");
    } finally {
      setDeleting(false);
    }
  };

  // Filtered rows
  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const currentLeadStatus = getLeadStatus(run);
      if (statusFilter !== "all" && currentLeadStatus !== statusFilter) {
        return false;
      }
      if (!search.trim()) return true;

      const q = search.toLowerCase();
      const contactName = run.contact?.name?.toLowerCase() || "";
      const contactPhone = run.contact?.phone || "";
      const varsText = Object.entries(run.vars || {})
        .filter(([k]) => k !== "lead_status")
        .map(([k, v]) => `${k}:${v}`)
        .join(" ")
        .toLowerCase();

      return (
        contactName.includes(q) ||
        contactPhone.includes(q) ||
        varsText.includes(q)
      );
    });
  }, [runs, statusFilter, search]);

  // Analytics stats
  const stats = useMemo(() => {
    const total = runs.length;
    const withData = runs.filter(
      (r) =>
        Object.keys(r.vars || {}).filter((k) => k !== "lead_status").length > 0
    ).length;
    const newCount = runs.filter((r) => getLeadStatus(r) === "new").length;
    const contactedCount = runs.filter((r) => getLeadStatus(r) === "contacted").length;
    return { total, withData, newCount, contactedCount };
  }, [runs]);

  // Export collected data as CSV
  const handleExportCSV = () => {
    if (runs.length === 0) {
      toast.error("No data to export");
      return;
    }

    // Collect all unique variable keys across runs
    const varKeysSet = new Set<string>();
    runs.forEach((r) => {
      Object.keys(r.vars || {}).forEach((k) => {
        if (k !== "lead_status") varKeysSet.add(k);
      });
    });
    const varKeys = Array.from(varKeysSet);

    const headers = [
      "Contact Name",
      "Phone",
      "Lead Status",
      "Flow Status",
      ...varKeys,
      "Started At",
    ];

    const rows = runs.map((r) => {
      const leadStatus = getLeadStatus(r);
      const varValues = varKeys.map((k) => {
        const val = r.vars?.[k];
        return val != null ? String(val).replace(/"/g, '""') : "";
      });
      return [
        `"${(r.contact?.name || "").replace(/"/g, '""')}"`,
        `"${r.contact?.phone || ""}"`,
        `"${leadStatus}"`,
        `"${r.status}"`,
        ...varValues.map((v) => `"${v}"`),
        `"${format(new Date(r.started_at), "yyyy-MM-dd HH:mm:ss")}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `${(flow?.name || "flow").replace(/\s+/g, "_")}_leads_${format(new Date(), "yyyyMMdd")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/flows")}
            className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {flow?.name || "Flow"}
              </h1>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs">
                Analytics & Leads
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Review and manage all user responses and contact details collected by this flow.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={runs.length === 0}
            className="gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/flows/${flowId}/runs`)}
            className="gap-1.5 text-xs"
          >
            <Clock className="h-3.5 w-3.5" />
            Execution Logs
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/flows/${flowId}`)}
            className="gap-1.5 text-xs"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Flow
          </Button>
        </div>
      </div>

      {/* Analytics KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Responses</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{stats.total}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {stats.withData} with collected answers
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-xs font-medium">New Leads</span>
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-500">{stats.newCount}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Awaiting follow-up</p>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-500">
            <span className="text-xs font-medium">Contacted Leads</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-500">{stats.contactedCount}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Follow-up completed</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Capture Rate</span>
            <FileSpreadsheet className="h-4 w-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {stats.total > 0 ? `${Math.round((stats.withData / stats.total) * 100)}%` : "0%"}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Lead completion rate</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/60 p-1">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              statusFilter === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("new")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              statusFilter === "new"
                ? "bg-background text-amber-500 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            New ({stats.newCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("contacted")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              statusFilter === "contacted"
                ? "bg-background text-emerald-500 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Contacted ({stats.contactedCount})
          </button>
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, responses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-xs bg-card"
          />
        </div>
      </div>

      {/* Collected Data Table */}
      {filteredRuns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">No collected data found</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {search || statusFilter !== "all"
              ? "No records match your active search or status filters."
              : "When customers interact with this flow's Collect Input nodes, their responses will automatically show up here."}
          </p>
          {(search || statusFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
              className="mt-4 text-xs"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Collected Information</th>
                  <th className="px-4 py-3 font-semibold">Lead Status</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRuns.map((run) => {
                  const leadStatus = getLeadStatus(run);
                  const capturedEntries = Object.entries(run.vars || {}).filter(
                    ([k]) => k !== "lead_status"
                  );
                  const isUpdating = updatingId === run.id;

                  return (
                    <tr
                      key={run.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      {/* Contact Column */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-medium text-foreground">
                          {run.contact?.name || "Unnamed Contact"}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                          <span className="font-mono">{run.contact?.phone || "No phone"}</span>
                        </div>
                      </td>

                      {/* Collected Variables Column */}
                      <td className="px-4 py-3.5 align-top">
                        {capturedEntries.length === 0 ? (
                          <span className="italic text-muted-foreground">
                            No input collected yet
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-xl">
                            {capturedEntries.map(([key, value]) => (
                              <div
                                key={key}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2.5 py-1 text-xs"
                              >
                                <span className="font-medium text-muted-foreground capitalize">
                                  {key.replace(/_/g, " ")}:
                                </span>
                                <span className="font-semibold text-foreground">
                                  {String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Status Toggle Column */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(run.id, "new")}
                            className={cn(
                              "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all",
                              leadStatus === "new"
                                ? "bg-amber-500 text-white shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                leadStatus === "new" ? "bg-white" : "bg-amber-500"
                              )}
                            />
                            New
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(run.id, "contacted")}
                            className={cn(
                              "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all",
                              leadStatus === "contacted"
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Contacted
                          </button>
                        </div>
                      </td>

                      {/* Submitted Time Column */}
                      <td className="px-4 py-3.5 align-top text-muted-foreground">
                        <div>{format(new Date(run.started_at), "PP p")}</div>
                        <div className="mt-0.5 text-[10px]">
                          {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="px-4 py-3.5 text-right align-top">
                        <div className="flex items-center justify-end gap-1">
                          {run.contact?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/inbox?contactId=${run.contact?.id}`)}
                              className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10 text-xs"
                              title="Chat in Inbox"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline ml-1">Chat</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteRunId(run.id)}
                            className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            title="Delete this record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteRunId} onOpenChange={(open) => !open && setDeleteRunId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Lead Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this collected submission? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setDeleteRunId(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRun}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
