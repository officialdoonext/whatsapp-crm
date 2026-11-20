"use client";

import { useEffect, useState } from "react";
import {
  Layers,
  Image as ImageIcon,
  FileText,
  Video,
  Music,
  CheckCircle2,
  Key,
  Globe,
  Lock,
  Save,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  Cloud,
  Sliders,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { StorageIntegrations, MediaPreferences } from "@/types";

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ImageKit fields
  const [ikPublicKey, setIkPublicKey] = useState("");
  const [ikPrivateKey, setIkPrivateKey] = useState("");
  const [ikUrlEndpoint, setIkUrlEndpoint] = useState("");
  const [showIkSecret, setShowIkSecret] = useState(false);

  // Cloudinary fields
  const [cldCloudName, setCldCloudName] = useState("");
  const [cldApiKey, setCldApiKey] = useState("");
  const [cldApiSecret, setCldApiSecret] = useState("");
  const [cldUploadPreset, setCldUploadPreset] = useState("");
  const [showCldSecret, setShowCldSecret] = useState(false);

  // Media Routing Preferences
  const [preferences, setPreferences] = useState<MediaPreferences>({
    images: "imagekit",
    documents: "imagekit",
    videos: "cloudinary",
    audio: "cloudinary",
  });

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/storage");
      const data = await res.json();

      if (res.ok) {
        if (data.imagekit_config) {
          setIkPublicKey(data.imagekit_config.publicKey || "");
          setIkPrivateKey(data.imagekit_config.privateKey || "");
          setIkUrlEndpoint(data.imagekit_config.urlEndpoint || "");
        }
        if (data.cloudinary_config) {
          setCldCloudName(data.cloudinary_config.cloudName || "");
          setCldApiKey(data.cloudinary_config.apiKey || "");
          setCldApiSecret(data.cloudinary_config.apiSecret || "");
          setCldUploadPreset(data.cloudinary_config.uploadPreset || "");
        }
        if (data.media_preferences) {
          setPreferences({
            images: data.media_preferences.images || "imagekit",
            documents: data.media_preferences.documents || "imagekit",
            videos: data.media_preferences.videos || "cloudinary",
            audio: data.media_preferences.audio || "cloudinary",
          });
        }
      }
    } catch {
      toast.error("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        imagekit_config: {
          publicKey: ikPublicKey.trim(),
          privateKey: ikPrivateKey.trim(),
          urlEndpoint: ikUrlEndpoint.trim(),
        },
        cloudinary_config: {
          cloudName: cldCloudName.trim(),
          apiKey: cldApiKey.trim(),
          apiSecret: cldApiSecret.trim(),
          uploadPreset: cldUploadPreset.trim(),
        },
        media_preferences: preferences,
      };

      const res = await fetch("/api/integrations/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save integrations");
      }

      toast.success("Storage integrations and media preferences saved successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save integrations");
    } finally {
      setSaving(false);
    }
  };

  const isIkConfigured = Boolean(ikPrivateKey && (ikPublicKey || ikUrlEndpoint));
  const isCldConfigured = Boolean(cldCloudName && (cldApiKey || cldUploadPreset));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Cloud className="size-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Media Integrations</h1>
            <Badge variant="outline" className="text-xs font-semibold">
              Storage CDN
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect ImageKit and Cloudinary to optimize, store, and stream all images, PDFs, videos, and audio files.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchIntegrations}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => handleSaveAll()}
            disabled={saving || loading}
            className="gap-1.5 font-semibold shadow-xs"
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save Integrations
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs Container */}
      <Tabs defaultValue="selection" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md bg-muted/60 p-1">
          <TabsTrigger value="imagekit" className="gap-1.5 text-xs font-medium">
            <ImageIcon className="size-3.5" />
            ImageKit
            {isIkConfigured && (
              <span className="ml-1 size-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            )}
          </TabsTrigger>
          <TabsTrigger value="cloudinary" className="gap-1.5 text-xs font-medium">
            <Cloud className="size-3.5" />
            Cloudinary
            {isCldConfigured && (
              <span className="ml-1 size-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            )}
          </TabsTrigger>
          <TabsTrigger value="selection" className="gap-1.5 text-xs font-medium">
            <Sliders className="size-3.5" />
            Routing Selection
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: ImageKit */}
        <TabsContent value="imagekit" className="space-y-4">
          <Card className="rounded-2xl border-border bg-card shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                    <ImageIcon className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">ImageKit Configuration</CardTitle>
                    <CardDescription className="text-xs">
                      High-performance image transformation, optimization, and real-time CDN delivery.
                    </CardDescription>
                  </div>
                </div>

                <Badge
                  variant={isIkConfigured ? "default" : "secondary"}
                  className="gap-1 text-[11px]"
                >
                  {isIkConfigured ? (
                    <>
                      <CheckCircle2 className="size-3 text-emerald-400" />
                      Connected
                    </>
                  ) : (
                    "Not Configured"
                  )}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Public Key <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="public_xxxxxxxxxxxxxxxxxxxx"
                      value={ikPublicKey}
                      onChange={(e) => setIkPublicKey(e.target.value)}
                      className="pl-9 font-mono text-xs"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Found in ImageKit Dashboard → Developer Options → API Keys.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    URL Endpoint <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="https://ik.imagekit.io/your_id"
                      value={ikUrlEndpoint}
                      onChange={(e) => setIkUrlEndpoint(e.target.value)}
                      className="pl-9 font-mono text-xs"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Your ImageKit unique endpoint URL for public media delivery.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Private Key <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={showIkSecret ? "text" : "password"}
                    placeholder="private_xxxxxxxxxxxxxxxxxxxx"
                    value={ikPrivateKey}
                    onChange={(e) => setIkPrivateKey(e.target.value)}
                    className="pl-9 pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowIkSecret(!showIkSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showIkSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Secret key used securely on the server to authenticate direct uploads.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={() => handleSaveAll()}
                  disabled={saving}
                  className="gap-1.5 font-semibold"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  Save ImageKit Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Cloudinary */}
        <TabsContent value="cloudinary" className="space-y-4">
          <Card className="rounded-2xl border-border bg-card shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                    <Cloud className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">Cloudinary Configuration</CardTitle>
                    <CardDescription className="text-xs">
                      End-to-end media management, dynamic video streaming, and document hosting.
                    </CardDescription>
                  </div>
                </div>

                <Badge
                  variant={isCldConfigured ? "default" : "secondary"}
                  className="gap-1 text-[11px]"
                >
                  {isCldConfigured ? (
                    <>
                      <CheckCircle2 className="size-3 text-emerald-400" />
                      Connected
                    </>
                  ) : (
                    "Not Configured"
                  )}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Cloud Name <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Cloud className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="e.g. doonext-cloud"
                      value={cldCloudName}
                      onChange={(e) => setCldCloudName(e.target.value)}
                      className="pl-9 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">API Key</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="e.g. 123456789012345"
                      value={cldApiKey}
                      onChange={(e) => setCldApiKey(e.target.value)}
                      className="pl-9 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">API Secret</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type={showCldSecret ? "text" : "password"}
                      placeholder="Cloudinary API Secret"
                      value={cldApiSecret}
                      onChange={(e) => setCldApiSecret(e.target.value)}
                      className="pl-9 pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCldSecret(!showCldSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCldSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Upload Preset <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. wacrm_preset (for unsigned uploads)"
                    value={cldUploadPreset}
                    onChange={(e) => setCldUploadPreset(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={() => handleSaveAll()}
                  disabled={saving}
                  className="gap-1.5 font-semibold"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  Save Cloudinary Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Media Preferences Selection */}
        <TabsContent value="selection" className="space-y-4">
          <Card className="rounded-2xl border-border bg-card shadow-xs">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Sliders className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Storage Routing Selection</CardTitle>
                  <CardDescription className="text-xs">
                    Choose which provider handles each file format across product catalogs, chat attachments, and broadcasts.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-1">
              {/* Images Routing */}
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-border/70 p-4 transition-all hover:border-primary/40 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ImageIcon className="size-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Images & Photos</h4>
                    <p className="text-xs text-muted-foreground">
                      Product thumbnails, catalog pictures, customer avatars, and chat media.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreferences({ ...preferences, images: "imagekit" })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      preferences.images === "imagekit"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    ImageKit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferences({ ...preferences, images: "cloudinary" })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      preferences.images === "cloudinary"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Cloudinary
                  </button>
                </div>
              </div>

              {/* PDFs & Documents Routing */}
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-border/70 p-4 transition-all hover:border-primary/40 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                    <FileText className="size-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">PDFs & Documents</h4>
                    <p className="text-xs text-muted-foreground">
                      Invoices, product brochures, receipts, and order summaries.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreferences({ ...preferences, documents: "imagekit" })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      preferences.documents === "imagekit"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    ImageKit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferences({ ...preferences, documents: "cloudinary" })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      preferences.documents === "cloudinary"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Cloudinary
                  </button>
                </div>
              </div>

              {/* Videos Routing */}
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-border/70 p-4 transition-all hover:border-primary/40 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                    <Video className="size-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Videos</h4>
                    <p className="text-xs text-muted-foreground">
                      Product demo clips, broadcast video messages, and walkthroughs.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreferences({ ...preferences, videos: "imagekit" })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      preferences.videos === "imagekit"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    ImageKit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferences({ ...preferences, videos: "cloudinary" })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      preferences.videos === "cloudinary"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Cloudinary
                  </button>
                </div>
              </div>

              {/* Audio Files Routing */}
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-border/70 p-4 transition-all hover:border-primary/40 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                    <Music className="size-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Audio & Voice Notes</h4>
                    <p className="text-xs text-muted-foreground">
                      Voice notes recorded in WhatsApp composer, audio guides, and alerts.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreferences({ ...preferences, audio: "imagekit" })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      preferences.audio === "imagekit"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    ImageKit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferences({ ...preferences, audio: "cloudinary" })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      preferences.audio === "cloudinary"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Cloudinary
                  </button>
                </div>
              </div>

              {/* Bottom Save Bar */}
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  Automatic 80KB compression applied before uploads
                </div>

                <Button
                  size="sm"
                  onClick={() => handleSaveAll()}
                  disabled={saving}
                  className="gap-1.5 font-semibold shadow-xs"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-3.5" />
                      Save Preferences
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
