"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2, ShieldAlert, KeyRound, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function DeleteAccountCard() {
  const { user, profile, accountRole } = useAuth();
  const supabase = createClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [emailInput, setEmailInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isOwner = accountRole === "owner";
  const userEmail = user?.email || profile?.email || "";

  const handleOpenDialog = () => {
    setStep("email");
    setEmailInput("");
    setCodeInput("");
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (emailInput.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      setErrorMsg("The email address does not match your account email.");
      return;
    }

    try {
      setSendingCode(true);
      const res = await fetch("/api/account/delete/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to send verification code.");
        toast.error(data.error || "Failed to send code.");
        return;
      }

      toast.success("Confirmation code sent to your email!");
      setStep("code");
    } catch (err) {
      console.error(err);
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSendingCode(false);
    }
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!codeInput.trim() || codeInput.trim().length < 6) {
      setErrorMsg("Please enter the complete 6-digit confirmation code.");
      return;
    }

    try {
      setDeleting(true);
      const res = await fetch("/api/account/delete/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          code: codeInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to delete account.");
        toast.error(data.error || "Failed to delete account.");
        setDeleting(false);
        return;
      }

      toast.success("Account and data permanently deleted. Logging out...");

      // Sign out and redirect to /login
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (err) {
      console.error(err);
      setErrorMsg("Network error during deletion.");
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="border-red-500/30 bg-red-500/5 shadow-2xs">
        <CardHeader className="gap-2">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="size-5 shrink-0" />
            <CardTitle className="text-base text-red-500">Danger Zone — Delete Account</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground leading-relaxed">
            Permanently delete your account and all associated WhatsApp data, messages, contacts, automations, flows, and configurations. Once deleted, this data cannot be recovered.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-foreground">Irreversible Action</p>
              <p className="text-[11px] text-muted-foreground">
                Requires email verification code before any data is erased.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={handleOpenDialog}
              disabled={!isOwner}
              className="h-9 px-4 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-xs active:scale-95 shrink-0"
            >
              <Trash2 className="size-3.5 mr-1.5" />
              Delete Account
            </Button>
          </div>
          {!isOwner && (
            <p className="mt-2 text-[11px] text-amber-500">
              Only the account owner can request account deletion.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Account Deletion Multi-Step Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-red-500">
              <ShieldAlert className="size-5 text-red-500" />
              Delete Account & All Data
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              {step === "email"
                ? "Confirm your email address to receive a secure 6-digit confirmation code."
                : `Enter the 6-digit confirmation code sent to ${userEmail}.`}
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {errorMsg}
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="delete-email-input" className="text-xs font-medium text-foreground">
                  Confirm Account Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="delete-email-input"
                    type="email"
                    required
                    placeholder={userEmail || "your-email@example.com"}
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="h-9 pl-9 text-xs border-border/80 bg-muted/30 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Type <span className="font-mono text-foreground font-semibold">{userEmail}</span> to proceed.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={sendingCode || !emailInput.trim()}
                  className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                >
                  {sendingCode ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" />
                      Sending Code...
                    </span>
                  ) : (
                    "Send Confirmation Code"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleConfirmDelete} className="space-y-4 pt-2">
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 space-y-1">
                <p className="font-semibold text-red-400">Final Confirmation Warning:</p>
                <p>
                  This will permanently erase all contacts, messages, automations, WhatsApp API configurations, and your user account. This cannot be undone.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="delete-code-input" className="text-xs font-medium text-foreground">
                  6-Digit Confirmation Code
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="delete-code-input"
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ""))}
                    className="h-10 pl-9 text-center font-mono text-base tracking-widest border-border/80 bg-muted/30 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sendingCode}
                  className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  {sendingCode ? "Resending..." : "Resend code"}
                </button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={deleting || codeInput.length < 6}
                    className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
                  >
                    {deleting ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="size-3.5 animate-spin" />
                        Deleting All Data...
                      </span>
                    ) : (
                      "Permanently Delete Account"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
