"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  Store,
  Clock,
  Phone,
  MapPin,
  Upload,
  CheckCircle2,
  XCircle,
  Calendar,
  Share2,
  ExternalLink,
  Copy,
  Edit3,
  Power,
  Sparkles,
  Loader2,
  Check,
  Building,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { compressImageTo80KB } from "@/lib/media/compress-image";
import { computeStoreStatus, type StoreStatusResult } from "@/lib/commerce/store-status";
import type { StoreProfile } from "@/types";

const ALL_DAYS = [
  { id: "monday", label: "Mon", full: "Monday" },
  { id: "tuesday", label: "Tue", full: "Tuesday" },
  { id: "wednesday", label: "Wed", full: "Wednesday" },
  { id: "thursday", label: "Thu", full: "Thursday" },
  { id: "friday", label: "Fri", full: "Friday" },
  { id: "saturday", label: "Sat", full: "Saturday" },
  { id: "sunday", label: "Sun", full: "Sunday" },
];

export default function StorePage() {
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusResult, setStatusResult] = useState<StoreStatusResult | null>(null);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [openingTime, setOpeningTime] = useState("09:00");
  const [closingTime, setClosingTime] = useState("22:00");
  const [workingDays, setWorkingDays] = useState<string[]>([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]);
  const [manualOverride, setManualOverride] = useState<"auto" | "online" | "offline">("auto");

  // Logo file selection state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoSizeKb, setLogoSizeKb] = useState<number | null>(null);

  // Hours saving state
  const [hoursSaving, setHoursSaving] = useState(false);

  // Copied indicator
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch store details
  const fetchStore = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/commerce/store");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load store profile");
      }

      if (data.store) {
        setStore(data.store);
        const computed = computeStoreStatus(data.store);
        setStatusResult(computed);

        // Pre-fill form values for editing
        setName(data.store.name || "");
        setMobileNumber(data.store.mobile_number || "");
        setAddress(data.store.address || "");
        setLogoUrl(data.store.logo_url || "");
        setLogoPreview(data.store.logo_url || null);
        setOpeningTime(data.store.opening_time || "09:00");
        setClosingTime(data.store.closing_time || "22:00");
        setWorkingDays(
          Array.isArray(data.store.working_days) && data.store.working_days.length > 0
            ? data.store.working_days
            : ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        );
        setManualOverride(data.store.manual_override || "auto");
      } else {
        setStore(null);
        setStatusResult(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load store profile");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  // Recalculate status every minute for live opening/closing check
  useEffect(() => {
    if (!store) return;
    const interval = setInterval(() => {
      setStatusResult(computeStoreStatus(store));
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [store]);

  // Handle logo file selection
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WebP)");
      return;
    }

    setSelectedLogoFile(file);
    setLogoSizeKb(Math.round(file.size / 1024));

    const objectUrl = URL.createObjectURL(file);
    setLogoPreview(objectUrl);
  };

  // Open "Add Store" modal
  const handleOpenAddModal = () => {
    setIsEditing(false);
    setName("");
    setMobileNumber("");
    setAddress("");
    setLogoUrl("");
    setLogoPreview(null);
    setSelectedLogoFile(null);
    setLogoSizeKb(null);
    setOpeningTime("09:00");
    setClosingTime("22:00");
    setWorkingDays(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
    setManualOverride("auto");
    setIsModalOpen(true);
  };

  // Open "Edit Store" modal
  const handleOpenEditModal = () => {
    if (!store) return;
    setIsEditing(true);
    setName(store.name || "");
    setMobileNumber(store.mobile_number || "");
    setAddress(store.address || "");
    setLogoUrl(store.logo_url || "");
    setLogoPreview(store.logo_url || null);
    setSelectedLogoFile(null);
    setLogoSizeKb(null);
    setOpeningTime(store.opening_time || "09:00");
    setClosingTime(store.closing_time || "22:00");
    setWorkingDays(store.working_days || ALL_DAYS.map((d) => d.id));
    setManualOverride(store.manual_override || "auto");
    setIsModalOpen(true);
  };

  // Toggle working day
  const toggleWorkingDay = (dayId: string) => {
    setWorkingDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  // Save Store (Add or Edit)
  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedMobile = mobileNumber.trim();

    if (!trimmedName) {
      toast.error("Store name is required");
      return;
    }

    if (!trimmedMobile) {
      toast.error("Mobile number is required");
      return;
    }

    setModalSaving(true);
    setUploadProgress("Preparing store details...");

    try {
      let finalLogoUrl = logoUrl;

      // If user selected a new logo image, compress to <= 80KB first and upload to ImageKit / Cloudinary
      if (selectedLogoFile) {
        setUploadProgress("Compressing logo to ≤80KB without losing sharpness...");
        const compressedFile = await compressImageTo80KB(selectedLogoFile);

        setUploadProgress(
          `Uploading logo (${Math.round(compressedFile.size / 1024)}KB) to storage...`
        );

        const formData = new FormData();
        formData.append("file", compressedFile);
        formData.append("fileName", `store-logo-${Date.now()}.jpg`);
        formData.append("fileType", "images");

        const uploadRes = await fetch("/api/storage/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.url) {
          finalLogoUrl = uploadData.url;
        } else {
          console.warn("Upload failed, falling back to preview URL:", uploadData);
          if (logoPreview) finalLogoUrl = logoPreview;
        }
      }

      setUploadProgress(isEditing ? "Updating store profile..." : "Creating your store profile...");

      const payload = {
        name: trimmedName,
        mobile_number: trimmedMobile,
        address: address.trim() || undefined,
        logo_url: finalLogoUrl || undefined,
        opening_time: openingTime,
        closing_time: closingTime,
        working_days: workingDays,
        manual_override: manualOverride,
      };

      const res = await fetch("/api/commerce/store", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save store profile");
      }

      toast.success(isEditing ? "Store profile updated successfully!" : "Store created successfully!");
      setIsModalOpen(false);
      await fetchStore(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save store");
    } finally {
      setModalSaving(false);
      setUploadProgress(null);
    }
  };

  // Quick save for Operating Hours & Timing Tab
  const handleSaveOperatingHours = async () => {
    if (!store) return;
    setHoursSaving(true);
    try {
      const payload = {
        opening_time: openingTime,
        closing_time: closingTime,
        working_days: workingDays,
        manual_override: manualOverride,
      };

      const res = await fetch("/api/commerce/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update operating hours");
      }

      toast.success("Operating hours and timing schedule saved!");
      await fetchStore(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save operating hours");
    } finally {
      setHoursSaving(false);
    }
  };

  // Clean WhatsApp phone number for link
  const rawMobile = store?.mobile_number || "";
  const cleanedPhone = rawMobile.replace(/[^0-9]/g, "");
  const waChatLink = `https://wa.me/${cleanedPhone}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(waChatLink);
    setCopiedLink(true);
    toast.success("WhatsApp link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const formatTime12h = (hhmm: string) => {
    if (!hhmm) return "";
    const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10) || 0);
    const suffix = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 || 12;
    const displayM = m < 10 ? `0${m}` : m;
    return `${displayH}:${displayM} ${suffix}`;
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading store profile...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Store Profile
            </h1>
            {store && statusResult && (
              <Badge
                variant={statusResult.isOpen ? "default" : "secondary"}
                className={`flex items-center gap-1.5 px-3 py-1 font-medium text-xs ${
                  statusResult.isOpen
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    statusResult.isOpen
                      ? "bg-white animate-pulse"
                      : "bg-zinc-400 dark:bg-zinc-500"
                  }`}
                />
                {statusResult.statusLabel}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {store
              ? "Manage your WhatsApp store identity, operating hours, and customer storefront."
              : "Set up your WhatsApp business store profile and automated operating schedule."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {store ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchStore(true)}
                disabled={refreshing}
                className="gap-2 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenEditModal}
                className="gap-2 text-xs"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Profile
              </Button>
            </>
          ) : (
            <Button onClick={handleOpenAddModal} className="gap-2 shadow-sm">
              <Store className="h-4 w-4" />
              Add Store
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {!store ? (
        /* Empty State: No Store Configured */
        <Card className="border-dashed border-2 p-8 sm:p-12 text-center bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Store className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            No WhatsApp Store Created Yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Create your WhatsApp store to showcase your products, configure automated opening and
            closing hours, and accept direct orders from shoppers.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={handleOpenAddModal} size="lg" className="gap-2 shadow-sm w-full sm:w-auto">
              <Sparkles className="h-4 w-4" />
              Setup Your Store Now
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Note: Only one official store profile can be linked to your account.
          </p>
        </Card>
      ) : (
        /* Tab-based Store Profile Interface */
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md mb-6">
            <TabsTrigger value="profile" className="gap-2 text-xs sm:text-sm">
              <Store className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="timing" className="gap-2 text-xs sm:text-sm">
              <Clock className="h-4 w-4" />
              Operating Hours
            </TabsTrigger>
            <TabsTrigger value="storefront" className="gap-2 text-xs sm:text-sm">
              <Share2 className="h-4 w-4" />
              WhatsApp Link
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: STORE PROFILE */}
          <TabsContent value="profile" className="space-y-6">
            {/* Live Status Alert Banner */}
            <div
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border ${
                statusResult?.isOpen
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                  : "bg-zinc-500/10 border-zinc-500/30 text-zinc-950 dark:text-zinc-100"
              }`}
            >
              <div className="flex items-center gap-3">
                {statusResult?.isOpen ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                )}
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <span>Store Status:</span>
                    <span
                      className={
                        statusResult?.isOpen
                          ? "text-emerald-600 dark:text-emerald-400 font-bold"
                          : "text-zinc-600 dark:text-zinc-400 font-bold"
                      }
                    >
                      {statusResult?.statusLabel}
                    </span>
                    <Badge variant="outline" className="text-[11px] font-normal py-0">
                      {statusResult?.manualOverride === "auto"
                        ? "Automatic Timing"
                        : "Manual Override"}
                    </Badge>
                  </div>
                  <p className="text-xs opacity-80 mt-0.5">
                    {statusResult?.statusDescription}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs opacity-75">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Hours: {formatTime12h(store.opening_time)} – {formatTime12h(store.closing_time)}
                </span>
              </div>
            </div>

            {/* Profile Overview Card */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Identity Left Column */}
              <Card className="md:col-span-1 shadow-sm">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto relative h-28 w-28 rounded-2xl overflow-hidden border-2 border-border shadow-sm bg-muted flex items-center justify-center">
                    {store.logo_url ? (
                      <Image
                        src={store.logo_url}
                        alt={store.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <Building className="h-12 w-12 text-muted-foreground/60" />
                    )}
                  </div>
                  <CardTitle className="mt-4 text-xl font-bold">{store.name}</CardTitle>
                  <CardDescription className="text-xs font-mono">
                    Account ID: {store.account_id.slice(0, 8)}...
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border text-sm">
                    <Phone className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Mobile / WhatsApp</p>
                      <p className="font-medium truncate">{store.mobile_number}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border text-sm">
                    <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Store Address</p>
                      <p className="font-medium text-xs leading-relaxed whitespace-pre-wrap">
                        {store.address || "No address specified"}
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handleOpenEditModal}
                    variant="outline"
                    className="w-full gap-2 text-xs"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit Details & Logo
                  </Button>
                </CardContent>
              </Card>

              {/* Operating Info Right Column */}
              <div className="md:col-span-2 space-y-6">
                {/* Highlights Card */}
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Operating Schedule & Timings
                    </CardTitle>
                    <CardDescription>
                      The store automatically switches to <strong>Online</strong> at Opening Time
                      and <strong>Offline</strong> at End Time.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border bg-muted/30">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                          Opening Time
                        </span>
                        <p className="text-2xl font-bold text-foreground mt-1">
                          {formatTime12h(store.opening_time)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          24-hour: {store.opening_time}
                        </p>
                      </div>

                      <div className="p-4 rounded-xl border bg-muted/30">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                          Closing / End Time
                        </span>
                        <p className="text-2xl font-bold text-foreground mt-1">
                          {formatTime12h(store.closing_time)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          24-hour: {store.closing_time}
                        </p>
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Active Working Days
                      </span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {ALL_DAYS.map((day) => {
                          const isActive = store.working_days?.includes(day.id);
                          return (
                            <Badge
                              key={day.id}
                              variant={isActive ? "default" : "outline"}
                              className={`text-xs py-1 px-3 ${
                                isActive
                                  ? "bg-primary text-primary-foreground font-medium"
                                  : "opacity-40"
                              }`}
                            >
                              {day.full}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* WhatsApp Link Quick Box */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Share2 className="h-4 w-4 text-primary" />
                      Customer WhatsApp Contact
                    </CardTitle>
                    <CardDescription>
                      Share your direct WhatsApp chat link with customers to start receiving orders.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={waChatLink}
                        readOnly
                        className="font-mono text-xs bg-muted/50"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCopyLink}
                        className="gap-1.5 shrink-0 text-xs"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => window.open(waChatLink, "_blank")}
                        className="shrink-0 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Chat
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: OPERATING HOURS & TIMINGS */}
          <TabsContent value="timing" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Store Timings & Automatic Schedule
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Set your opening time and end time. In automatic mode, the store will strictly
                      be <strong>Online</strong> during this window and <strong>Offline</strong>{" "}
                      outside it.
                    </CardDescription>
                  </div>
                  {statusResult && (
                    <Badge
                      variant={statusResult.isOpen ? "default" : "secondary"}
                      className={`text-xs px-3 py-1 ${
                        statusResult.isOpen
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-200 dark:bg-zinc-800"
                      }`}
                    >
                      Currently: {statusResult.statusLabel}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Mode Selector */}
                <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Power className="h-4 w-4 text-primary" />
                    Status Control Mode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Choose whether status follows the clock or is forced manually.
                  </p>

                  <div className="grid sm:grid-cols-3 gap-3 pt-1">
                    <div
                      onClick={() => setManualOverride("auto")}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        manualOverride === "auto"
                          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                          : "hover:border-zinc-300 dark:hover:border-zinc-700 bg-background"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          Automatic Schedule
                        </span>
                        {manualOverride === "auto" && (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Online strictly between opening & end time.
                      </p>
                    </div>

                    <div
                      onClick={() => setManualOverride("online")}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        manualOverride === "online"
                          ? "border-emerald-500 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500"
                          : "hover:border-zinc-300 dark:hover:border-zinc-700 bg-background"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Force Online
                        </span>
                        {manualOverride === "online" && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Override schedule: Keep store open continuously.
                      </p>
                    </div>

                    <div
                      onClick={() => setManualOverride("offline")}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        manualOverride === "offline"
                          ? "border-destructive bg-destructive/10 shadow-sm ring-1 ring-destructive"
                          : "hover:border-zinc-300 dark:hover:border-zinc-700 bg-background"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-destructive flex items-center gap-1.5">
                          <XCircle className="h-3.5 w-3.5" />
                          Force Offline
                        </span>
                        {manualOverride === "offline" && (
                          <CheckCircle2 className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Temporarily close store (holidays / stock count).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Timing pickers */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="open-time" className="text-xs font-semibold">
                      Opening Time (HH:MM)
                    </Label>
                    <Input
                      id="open-time"
                      type="time"
                      value={openingTime}
                      onChange={(e) => setOpeningTime(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Store automatically enables at {formatTime12h(openingTime)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="close-time" className="text-xs font-semibold">
                      Closing / End Time (HH:MM)
                    </Label>
                    <Input
                      id="close-time"
                      type="time"
                      value={closingTime}
                      onChange={(e) => setClosingTime(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Store automatically disables at {formatTime12h(closingTime)}
                    </p>
                  </div>
                </div>

                {/* Working Days */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Working Days
                    </Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setWorkingDays(ALL_DAYS.map((d) => d.id))}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-muted-foreground text-xs">•</span>
                      <button
                        type="button"
                        onClick={() =>
                          setWorkingDays(["monday", "tuesday", "wednesday", "thursday", "friday"])
                        }
                        className="text-[11px] text-primary hover:underline"
                      >
                        Mon-Fri
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {ALL_DAYS.map((day) => {
                      const selected = workingDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleWorkingDay(day.id)}
                          className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg border text-xs transition-all ${
                            selected
                              ? "bg-primary text-primary-foreground font-semibold border-primary shadow-xs"
                              : "bg-muted/40 hover:bg-muted text-muted-foreground border-transparent"
                          }`}
                        >
                          <span className="text-xs font-medium">{day.label}</span>
                          <span className="text-[10px] opacity-80 mt-0.5">{day.full}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleSaveOperatingHours}
                    disabled={hoursSaving}
                    className="gap-2 shadow-sm"
                  >
                    {hoursSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving Schedule...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Save Operating Hours
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: WHATSAPP LINK & SHARE */}
          <TabsContent value="storefront" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-primary" />
                  WhatsApp Direct Chat & Catalog Link
                </CardTitle>
                <CardDescription>
                  Use this link on Instagram bio, Google Maps, Facebook ads, and website banners to
                  drive direct WhatsApp purchases.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Your WhatsApp Storefront URL
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={waChatLink}
                      readOnly
                      className="font-mono text-sm bg-background"
                    />
                    <Button
                      onClick={handleCopyLink}
                      variant="secondary"
                      className="gap-1.5 shrink-0"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy Link
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                  <Button
                    size="lg"
                    onClick={() => window.open(waChatLink, "_blank")}
                    className="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open WhatsApp Chat
                  </Button>

                  <p className="text-xs text-muted-foreground text-center sm:text-left">
                    Opens a chat directly with +{cleanedPhone} in the WhatsApp app or WhatsApp Web.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ADD / EDIT STORE MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Store className="h-5 w-5 text-primary" />
              {isEditing ? "Edit Store Profile" : "Add Store Profile"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update your store information, contact details, logo, and timings."
                : "Enter your store details. Once saved, your store profile will be created."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveStore} className="space-y-5 py-2">
            {/* Store Name */}
            <div className="space-y-1.5">
              <Label htmlFor="store-name" className="text-xs font-semibold">
                Store Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="store-name"
                placeholder="e.g. Fresh Groceries & Organic Foods"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Mobile Number */}
            <div className="space-y-1.5">
              <Label htmlFor="store-mobile" className="text-xs font-semibold">
                Mobile Number (with Country Code) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="store-mobile"
                placeholder="e.g. +91 98765 43210"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                This is the number customers will reach on WhatsApp.
              </p>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label htmlFor="store-address" className="text-xs font-semibold">
                Store Address
              </Label>
              <Textarea
                id="store-address"
                placeholder="e.g. Shop #12, Market Square, Hyderabad, Telangana 500081"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
              />
            </div>

            {/* Logo Upload with <= 80KB Compression */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                Store Logo (Auto-compressed to ≤80KB)
              </Label>

              <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/20">
                <div className="relative h-16 w-16 rounded-xl overflow-hidden border bg-background shrink-0 flex items-center justify-center">
                  {logoPreview ? (
                    <Image
                      src={logoPreview}
                      alt="Logo Preview"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <Store className="h-7 w-7 text-muted-foreground/40" />
                  )}
                </div>

                <div className="space-y-1 flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2 text-xs"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {logoPreview ? "Change Logo" : "Choose Logo Image"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedLogoFile
                      ? `Selected: ${selectedLogoFile.name} (${logoSizeKb}KB) • Will compress to ≤80KB`
                      : "PNG, JPG, or WebP. Automatically compressed to ≤80KB before upload."}
                  </p>
                </div>
              </div>
            </div>

            {/* Operating Times */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="modal-open-time" className="text-xs font-semibold">
                  Opening Time
                </Label>
                <Input
                  id="modal-open-time"
                  type="time"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="modal-close-time" className="text-xs font-semibold">
                  End / Closing Time
                </Label>
                <Input
                  id="modal-close-time"
                  type="time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>

            {/* Upload / Saving progress feedback */}
            {uploadProgress && (
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>{uploadProgress}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={modalSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={modalSaving} className="gap-2 shadow-sm">
                {modalSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving Store...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {isEditing ? "Update Store" : "Save Store"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
