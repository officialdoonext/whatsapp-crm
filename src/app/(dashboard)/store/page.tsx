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
  Eye,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import type { StoreProfile, PaymentGatewayConfig, NotificationTemplateConfig } from "@/types";

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

  // Available WhatsApp Templates for dropdown
  const [availableTemplates, setAvailableTemplates] = useState<{ id: string; name: string }[]>([]);

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

  // Payment Gateways Config State
  const [paymentConfig, setPaymentConfig] = useState<PaymentGatewayConfig>({
    cod: { enabled: true, min_order_value: 0 },
    online: {
      enabled: false,
      provider: "razorpay",
      razorpay: { key_id: "", key_secret: "" },
      cashfree: { app_id: "", secret_key: "", env: "sandbox" },
      phonepe: { merchant_id: "", salt_key: "", salt_index: "1", env: "uat" },
    },
  });
  const [paymentSaving, setPaymentSaving] = useState(false);

  // WhatsApp Notification Templates State
  const [notifTemplates, setNotifTemplates] = useState<NotificationTemplateConfig>({
    created: "",
    preparing: "",
    packing: "",
    packaged: "",
    on_the_way: "",
    delivered: "",
    cancelled: "",
  });
  const [templatesSaving, setTemplatesSaving] = useState(false);

  // Logo file selection state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoSizeKb, setLogoSizeKb] = useState<number | null>(null);

  // Hours saving state
  const [hoursSaving, setHoursSaving] = useState(false);

  // Copied indicator
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedStorefront, setCopiedStorefront] = useState(false);

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

        // Payment gateways
        if (data.store.payment_gateway_config) {
          const pg = data.store.payment_gateway_config;
          setPaymentConfig({
            cod: {
              enabled: pg.cod?.enabled ?? false,
              min_order_value: pg.cod?.min_order_value || 0,
            },
            online: {
              enabled:
                pg.online?.enabled ??
                Boolean(pg.razorpay?.enabled || pg.cashfree?.enabled || pg.phonepe?.enabled),
              provider:
                pg.online?.provider ||
                (pg.cashfree?.enabled ? "cashfree" : pg.phonepe?.enabled ? "phonepe" : "razorpay"),
              razorpay: pg.online?.razorpay || pg.razorpay || { key_id: "", key_secret: "" },
              cashfree: pg.online?.cashfree || pg.cashfree || { app_id: "", secret_key: "", env: "sandbox" },
              phonepe: pg.online?.phonepe || pg.phonepe || { merchant_id: "", salt_key: "", salt_index: "1", env: "uat" },
            },
          });
        }

        // Templates
        if (data.store.notification_templates) {
          setNotifTemplates(data.store.notification_templates);
        }
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

  // Fetch available WhatsApp templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/commerce/templates");
      const data = await res.json();
      if (res.ok && data.templates) {
        setAvailableTemplates(data.templates);
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchStore();
    fetchTemplates();
  }, [fetchStore, fetchTemplates]);

  // Recalculate status every 30 seconds for live opening/closing check
  useEffect(() => {
    if (!store) return;
    const interval = setInterval(() => {
      setStatusResult(computeStoreStatus(store));
    }, 30000);
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

  // Save Payment Gateway Config
  const handleSavePaymentConfig = async () => {
    if (!store) return;
    setPaymentSaving(true);
    try {
      const p = paymentConfig.online?.provider || "razorpay";
      const fullPayload = {
        cod: paymentConfig.cod,
        online: paymentConfig.online,
        razorpay: {
          enabled: Boolean(paymentConfig.online?.enabled && p === "razorpay"),
          key_id: paymentConfig.online?.razorpay?.key_id || "",
          key_secret: paymentConfig.online?.razorpay?.key_secret || "",
        },
        cashfree: {
          enabled: Boolean(paymentConfig.online?.enabled && p === "cashfree"),
          app_id: paymentConfig.online?.cashfree?.app_id || "",
          secret_key: paymentConfig.online?.cashfree?.secret_key || "",
          env: paymentConfig.online?.cashfree?.env || "sandbox",
        },
        phonepe: {
          enabled: Boolean(paymentConfig.online?.enabled && p === "phonepe"),
          merchant_id: paymentConfig.online?.phonepe?.merchant_id || "",
          salt_key: paymentConfig.online?.phonepe?.salt_key || "",
          salt_index: paymentConfig.online?.phonepe?.salt_index || "1",
          env: paymentConfig.online?.phonepe?.env || "uat",
        },
      };

      const res = await fetch("/api/commerce/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_gateway_config: fullPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save payment gateways");
      toast.success("Payment settings saved successfully!");
      await fetchStore(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save payments");
    } finally {
      setPaymentSaving(false);
    }
  };

  // Save WhatsApp Notification Templates
  const handleSaveNotificationTemplates = async () => {
    if (!store) return;
    setTemplatesSaving(true);
    try {
      const res = await fetch("/api/commerce/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_templates: notifTemplates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save notification templates");
      toast.success("WhatsApp stage notification templates saved!");
      await fetchStore(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save templates");
    } finally {
      setTemplatesSaving(false);
    }
  };

  // Clean WhatsApp phone number for link
  const rawMobile = store?.mobile_number || "";
  const cleanedPhone = rawMobile.replace(/[^0-9]/g, "");
  const waChatLink = `https://wa.me/${cleanedPhone}`;

  // Public customer storefront link
  const publicStoreUrl = typeof window !== "undefined" && store ? `${window.location.origin}/user/${store.id}` : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(waChatLink);
    setCopiedLink(true);
    toast.success("WhatsApp link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyStorefront = () => {
    if (!publicStoreUrl) return;
    navigator.clipboard.writeText(publicStoreUrl);
    setCopiedStorefront(true);
    toast.success("Public Storefront link copied!");
    setTimeout(() => setCopiedStorefront(false), 2500);
  };

  const handlePreviewStore = () => {
    if (!store) return;
    window.open(`/user/${store.id}`, "_blank");
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
    <div className="space-y-6">
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
              ? "Manage your WhatsApp store identity, operating hours, payment gateways, and templates."
              : "Set up your WhatsApp business store profile and automated operating schedule."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {store ? (
            <>
              {/* PREVIEW BUTTON */}
              <Button
                onClick={handlePreviewStore}
                size="sm"
                className="gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <Eye className="h-3.5 w-3.5" />
                Preview Store
              </Button>

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
            closing hours, accept direct orders, and connect online payments.
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
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 max-w-2xl mb-6">
            <TabsTrigger value="profile" className="gap-1.5 text-xs">
              <Store className="h-3.5 w-3.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="timing" className="gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" />
              Hours
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5 text-xs">
              <CreditCard className="h-3.5 w-3.5" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="storefront" className="gap-1.5 text-xs">
              <Share2 className="h-3.5 w-3.5" />
              Store Links
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
                    Store ID: {store.id}
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

                {/* Customer Storefront URL Box */}
                <Card className="shadow-sm border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2 text-primary font-bold">
                        <Eye className="h-4 w-4" />
                        Customer Storefront URL (/user/{store.id})
                      </span>
                      <Button
                        size="sm"
                        onClick={handlePreviewStore}
                        className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Storefront
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Share this unique URL with your customers. No login required.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={publicStoreUrl}
                        readOnly
                        className="font-mono text-xs bg-background"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCopyStorefront}
                        className="gap-1.5 shrink-0 text-xs"
                      >
                        {copiedStorefront ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy Link
                          </>
                        )}
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
                      be <strong>Online</strong> during this window and <strong>Offline</strong> outside it.
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
                      Opening Time
                    </Label>
                    <TimePicker
                      id="open-time"
                      value={openingTime}
                      onChange={setOpeningTime}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Store automatically enables at {formatTime12h(openingTime)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="close-time" className="text-xs font-semibold">
                      Closing / End Time
                    </Label>
                    <TimePicker
                      id="close-time"
                      value={closingTime}
                      onChange={setClosingTime}
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

          {/* TAB 3: PAYMENT GATEWAYS CONFIGURATION */}
          <TabsContent value="payments" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Store Payment Methods
                </CardTitle>
                <CardDescription>
                  Configure payment options for customer checkout. Only enabled and configured
                  payment methods will be displayed to shoppers during order placement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 1. Cash on Delivery (COD) Section */}
                <div className="p-4 rounded-xl border bg-card space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center font-bold text-base">
                        💵
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">Cash on Delivery (COD)</h4>
                          <Badge
                            variant={paymentConfig.cod?.enabled ? "default" : "secondary"}
                            className={`text-[10px] py-0 px-2 ${
                              paymentConfig.cod?.enabled
                                ? "bg-emerald-600 text-white"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {paymentConfig.cod?.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Allow shoppers to pay with cash or direct UPI at delivery doorstep.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={paymentConfig.cod?.enabled ?? false}
                      onCheckedChange={(checked) =>
                        setPaymentConfig((prev) => ({
                          ...prev,
                          cod: {
                            enabled: checked,
                            min_order_value: prev.cod?.min_order_value || 0,
                          },
                        }))
                      }
                    />
                  </div>

                  {paymentConfig.cod?.enabled && (
                    <div className="pt-3 border-t max-w-xs space-y-1.5">
                      <Label className="text-xs font-semibold">Minimum Order for COD (₹)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={paymentConfig.cod?.min_order_value || 0}
                        onChange={(e) =>
                          setPaymentConfig((prev) => ({
                            ...prev,
                            cod: {
                              ...prev.cod!,
                              min_order_value: parseFloat(e.target.value) || 0,
                            },
                          }))
                        }
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* 2. Online Payment Gateway Section */}
                <div className="p-4 rounded-xl border bg-card space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold text-base">
                        💳
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">Online Payment</h4>
                          <Badge
                            variant={paymentConfig.online?.enabled ? "default" : "secondary"}
                            className={`text-[10px] py-0 px-2 ${
                              paymentConfig.online?.enabled
                                ? "bg-blue-600 text-white"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {paymentConfig.online?.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Accept digital payments online via UPI, Credit/Debit Cards, and Netbanking.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={paymentConfig.online?.enabled ?? false}
                      onCheckedChange={(checked) =>
                        setPaymentConfig((prev) => ({
                          ...prev,
                          online: {
                            enabled: checked,
                            provider: prev.online?.provider || "razorpay",
                            razorpay: prev.online?.razorpay || { key_id: "", key_secret: "" },
                            cashfree: prev.online?.cashfree || { app_id: "", secret_key: "", env: "sandbox" },
                            phonepe: prev.online?.phonepe || { merchant_id: "", salt_key: "", salt_index: "1", env: "uat" },
                          },
                        }))
                      }
                    />
                  </div>

                  {paymentConfig.online?.enabled && (
                    <div className="space-y-4 pt-3 border-t">
                      {/* Provider Selector */}
                      <div className="space-y-1.5 max-w-sm">
                        <Label className="text-xs font-semibold">Payment Gateway Provider</Label>
                        <select
                          className="w-full h-9 rounded-md border bg-background px-3 text-xs"
                          value={paymentConfig.online?.provider || "razorpay"}
                          onChange={(e) =>
                            setPaymentConfig((prev) => ({
                              ...prev,
                              online: {
                                ...prev.online!,
                                provider: e.target.value as "razorpay" | "cashfree" | "phonepe",
                              },
                            }))
                          }
                        >
                          <option value="razorpay">Razorpay (Recommended)</option>
                          <option value="cashfree">Cashfree Payments</option>
                          <option value="phonepe">PhonePe Payment Gateway</option>
                        </select>
                      </div>

                      {/* Razorpay Inputs */}
                      {(paymentConfig.online?.provider === "razorpay" ||
                        !paymentConfig.online?.provider) && (
                        <div className="p-3.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-blue-900 dark:text-blue-200">
                              Razorpay API Credentials
                            </span>
                            {paymentConfig.online?.razorpay?.key_id ? (
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                Configured
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                                Missing Key ID
                              </Badge>
                            )}
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold">Key ID</Label>
                              <Input
                                placeholder="rzp_live_..."
                                value={paymentConfig.online?.razorpay?.key_id || ""}
                                onChange={(e) =>
                                  setPaymentConfig((prev) => ({
                                    ...prev,
                                    online: {
                                      ...prev.online!,
                                      razorpay: {
                                        ...prev.online?.razorpay,
                                        key_id: e.target.value,
                                        key_secret: prev.online?.razorpay?.key_secret || "",
                                      },
                                    },
                                  }))
                                }
                                className="h-8 text-xs font-mono bg-background"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold">Key Secret</Label>
                              <Input
                                type="password"
                                placeholder="••••••••••••••••"
                                value={paymentConfig.online?.razorpay?.key_secret || ""}
                                onChange={(e) =>
                                  setPaymentConfig((prev) => ({
                                    ...prev,
                                    online: {
                                      ...prev.online!,
                                      razorpay: {
                                        ...prev.online?.razorpay,
                                        key_id: prev.online?.razorpay?.key_id || "",
                                        key_secret: e.target.value,
                                      },
                                    },
                                  }))
                                }
                                className="h-8 text-xs font-mono bg-background"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Cashfree Inputs */}
                      {paymentConfig.online?.provider === "cashfree" && (
                        <div className="p-3.5 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 space-y-3">
                          <span className="font-semibold text-xs text-purple-900 dark:text-purple-200">
                            Cashfree API Credentials
                          </span>
                          <div className="grid sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold">App ID</Label>
                              <Input
                                placeholder="CF..."
                                value={paymentConfig.online?.cashfree?.app_id || ""}
                                onChange={(e) =>
                                  setPaymentConfig((prev) => ({
                                    ...prev,
                                    online: {
                                      ...prev.online!,
                                      cashfree: {
                                        ...prev.online?.cashfree,
                                        app_id: e.target.value,
                                        secret_key: prev.online?.cashfree?.secret_key || "",
                                        env: prev.online?.cashfree?.env || "sandbox",
                                      },
                                    },
                                  }))
                                }
                                className="h-8 text-xs font-mono bg-background"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold">Secret Key</Label>
                              <Input
                                type="password"
                                placeholder="••••••••••••••••"
                                value={paymentConfig.online?.cashfree?.secret_key || ""}
                                onChange={(e) =>
                                  setPaymentConfig((prev) => ({
                                    ...prev,
                                    online: {
                                      ...prev.online!,
                                      cashfree: {
                                        ...prev.online?.cashfree,
                                        app_id: prev.online?.cashfree?.app_id || "",
                                        secret_key: e.target.value,
                                        env: prev.online?.cashfree?.env || "sandbox",
                                      },
                                    },
                                  }))
                                }
                                className="h-8 text-xs font-mono bg-background"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold">Environment</Label>
                              <select
                                className="w-full h-8 rounded-md border bg-background px-2 text-xs"
                                value={paymentConfig.online?.cashfree?.env || "sandbox"}
                                onChange={(e) =>
                                  setPaymentConfig((prev) => ({
                                    ...prev,
                                    online: {
                                      ...prev.online!,
                                      cashfree: {
                                        ...prev.online?.cashfree!,
                                        env: e.target.value as "sandbox" | "production",
                                      },
                                    },
                                  }))
                                }
                              >
                                <option value="sandbox">Sandbox (Test)</option>
                                <option value="production">Production (Live)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* PhonePe Inputs */}
                      {paymentConfig.online?.provider === "phonepe" && (
                        <div className="p-3.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 space-y-3">
                          <span className="font-semibold text-xs text-indigo-900 dark:text-indigo-200">
                            PhonePe API Credentials
                          </span>
                          <div className="grid sm:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold">Merchant ID</Label>
                              <Input
                                placeholder="PGTESTPAYUAT..."
                                value={paymentConfig.online?.phonepe?.merchant_id || ""}
                                onChange={(e) =>
                                  setPaymentConfig((prev) => ({
                                    ...prev,
                                    online: {
                                      ...prev.online!,
                                      phonepe: {
                                        ...prev.online?.phonepe,
                                        merchant_id: e.target.value,
                                        salt_key: prev.online?.phonepe?.salt_key || "",
                                        salt_index: prev.online?.phonepe?.salt_index || "1",
                                        env: prev.online?.phonepe?.env || "uat",
                                      },
                                    },
                                  }))
                                }
                                className="h-8 text-xs font-mono bg-background"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold">Salt Key</Label>
                              <Input
                                type="password"
                                placeholder="••••••••"
                                value={paymentConfig.online?.phonepe?.salt_key || ""}
                                onChange={(e) =>
                                  setPaymentConfig((prev) => ({
                                    ...prev,
                                    online: {
                                      ...prev.online!,
                                      phonepe: {
                                        ...prev.online?.phonepe,
                                        merchant_id: prev.online?.phonepe?.merchant_id || "",
                                        salt_key: e.target.value,
                                        salt_index: prev.online?.phonepe?.salt_index || "1",
                                        env: prev.online?.phonepe?.env || "uat",
                                      },
                                    },
                                  }))
                                }
                                className="h-8 text-xs font-mono bg-background"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold">Salt Index</Label>
                              <Input
                                placeholder="1"
                                value={paymentConfig.online?.phonepe?.salt_index || "1"}
                                onChange={(e) =>
                                  setPaymentConfig((prev) => ({
                                    ...prev,
                                    online: {
                                      ...prev.online!,
                                      phonepe: {
                                        ...prev.online?.phonepe,
                                        merchant_id: prev.online?.phonepe?.merchant_id || "",
                                        salt_key: prev.online?.phonepe?.salt_key || "",
                                        salt_index: e.target.value,
                                        env: prev.online?.phonepe?.env || "uat",
                                      },
                                    },
                                  }))
                                }
                                className="h-8 text-xs font-mono bg-background"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold">Environment</Label>
                              <select
                                className="w-full h-8 rounded-md border bg-background px-2 text-xs"
                                value={paymentConfig.online?.phonepe?.env || "uat"}
                                onChange={(e) =>
                                  setPaymentConfig((prev) => ({
                                    ...prev,
                                    online: {
                                      ...prev.online!,
                                      phonepe: {
                                        ...prev.online?.phonepe!,
                                        env: e.target.value as "uat" | "production",
                                      },
                                    },
                                  }))
                                }
                              >
                                <option value="uat">UAT (Test)</option>
                                <option value="production">Production</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleSavePaymentConfig}
                    disabled={paymentSaving}
                    className="gap-2 shadow-sm"
                  >
                    {paymentSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving Settings...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Save Payment Settings
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: WHATSAPP NOTIFICATION TEMPLATES */}
          <TabsContent value="templates" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Order Stage WhatsApp Templates
                </CardTitle>
                <CardDescription>
                  Select which WhatsApp message template is sent to the customer at each order
                  lifecycle stage. When an order transitions stage, the system sends the notification
                  automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* 1. Order Created */}
                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      1. Order Confirmed (Created)
                    </Label>
                    <Badge variant="outline" className="text-[11px]">Trigger: On Checkout</Badge>
                  </div>
                  <Input
                    placeholder="Enter template name (e.g. order_confirmed)"
                    value={notifTemplates.created || ""}
                    onChange={(e) => setNotifTemplates((p) => ({ ...p, created: e.target.value }))}
                    className="font-mono text-xs bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Sent automatically when customer finishes placing the order.
                  </p>
                </div>

                {/* 2. Preparation in Progress */}
                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      2. Preparation in Progress
                    </Label>
                    <Badge variant="outline" className="text-[11px]">Trigger: In Kitchen / Assembling</Badge>
                  </div>
                  <Input
                    placeholder="Enter template name (e.g. order_preparing)"
                    value={notifTemplates.preparing || ""}
                    onChange={(e) => setNotifTemplates((p) => ({ ...p, preparing: e.target.value }))}
                    className="font-mono text-xs bg-background"
                  />
                </div>

                {/* 3. Packing in Progress */}
                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      3. Packing in Progress
                    </Label>
                    <Badge variant="outline" className="text-[11px]">Trigger: Boxing & Sealing</Badge>
                  </div>
                  <Input
                    placeholder="Enter template name (e.g. order_packing)"
                    value={notifTemplates.packing || ""}
                    onChange={(e) => setNotifTemplates((p) => ({ ...p, packing: e.target.value }))}
                    className="font-mono text-xs bg-background"
                  />
                </div>

                {/* 4. Package Done */}
                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      4. Package Done
                    </Label>
                    <Badge variant="outline" className="text-[11px]">Trigger: Ready for Pickup</Badge>
                  </div>
                  <Input
                    placeholder="Enter template name (e.g. order_packaged)"
                    value={notifTemplates.packaged || ""}
                    onChange={(e) => setNotifTemplates((p) => ({ ...p, packaged: e.target.value }))}
                    className="font-mono text-xs bg-background"
                  />
                </div>

                {/* 5. On the Way to Delivery */}
                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      5. On the Way to Delivery
                    </Label>
                    <Badge variant="outline" className="text-[11px]">Trigger: Rider Dispatched</Badge>
                  </div>
                  <Input
                    placeholder="Enter template name (e.g. order_out_for_delivery)"
                    value={notifTemplates.on_the_way || ""}
                    onChange={(e) => setNotifTemplates((p) => ({ ...p, on_the_way: e.target.value }))}
                    className="font-mono text-xs bg-background"
                  />
                </div>

                {/* 6. Delivered */}
                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      6. Order Delivered
                    </Label>
                    <Badge variant="outline" className="text-[11px]">Trigger: Customer Received</Badge>
                  </div>
                  <Input
                    placeholder="Enter template name (e.g. order_delivered)"
                    value={notifTemplates.delivered || ""}
                    onChange={(e) => setNotifTemplates((p) => ({ ...p, delivered: e.target.value }))}
                    className="font-mono text-xs bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Sent automatically when store manager marks the order Delivered.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleSaveNotificationTemplates}
                    disabled={templatesSaving}
                    className="gap-2 shadow-sm"
                  >
                    {templatesSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving Templates...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Save Notification Templates
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: WHATSAPP LINK & SHARE */}
          <TabsContent value="storefront" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-primary" />
                  WhatsApp Direct Chat & Catalog Link
                </CardTitle>
                <CardDescription>
                  Share your direct WhatsApp chat link or public customer web storefront.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Public Web Storefront */}
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-primary uppercase tracking-wider">
                      Public Customer Storefront URL (No Login Required)
                    </Label>
                    <Badge className="bg-emerald-600 text-white text-[11px]">Online Storefront</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={publicStoreUrl}
                      readOnly
                      className="font-mono text-sm bg-background"
                    />
                    <Button
                      onClick={handleCopyStorefront}
                      variant="secondary"
                      className="gap-1.5 shrink-0"
                    >
                      {copiedStorefront ? (
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
                    <Button
                      onClick={handlePreviewStore}
                      className="gap-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Eye className="h-4 w-4" />
                      Preview
                    </Button>
                  </div>
                </div>

                {/* WhatsApp Chat Link */}
                <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Direct WhatsApp wa.me Link
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
                    <Button
                      onClick={() => window.open(waChatLink, "_blank")}
                      className="gap-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Chat
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ADD / EDIT STORE MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl w-full max-h-[90vh] overflow-y-auto">
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
                <TimePicker
                  id="modal-open-time"
                  value={openingTime}
                  onChange={setOpeningTime}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="modal-close-time" className="text-xs font-semibold">
                  End / Closing Time
                </Label>
                <TimePicker
                  id="modal-close-time"
                  value={closingTime}
                  onChange={setClosingTime}
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
