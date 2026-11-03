"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag } from "@/types";
import {
  Phone,
  Mail,
  Copy,
  Check,
  User,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { contactHandle } from "@/lib/whatsapp/wa-identity";

interface ContactSidebarProps {
  contact: Contact | null;
}

export function ContactSidebar({ contact }: ContactSidebarProps) {
  const tSidebar = useTranslations("Inbox.sidebar");
  const tThread = useTranslations("Inbox.messageThread");

  const { accountId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, and tags in parallel
    const [dealsRes, notesRes, tagsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }
  }, [contact]);

  useEffect(() => {
    fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    const handle = contact ? contactHandle(contact) : "";
    if (!handle) return;
    await navigator.clipboard.writeText(handle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    if (!accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  if (!contact) {
    return (
      <div className="flex h-full w-80 items-center justify-center border-l border-border bg-card/60 p-6 text-center">
        <div className="flex flex-col items-center gap-2.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/80 text-muted-foreground shadow-xs">
            <User className="h-6 w-6" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground">{tThread("selectConversation")}</p>
        </div>
      </div>
    );
  }

  const displayName = contact.name || contactHandle(contact);
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-80 flex-col border-l border-border bg-card">
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {/* Contact Profile Banner Card */}
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-primary/15 via-primary/5 to-card p-4 pt-5 text-center shadow-xs">
            {/* Top decorative gradient glow */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/30 via-primary to-primary/30" />

            {/* Avatar */}
            <div className="relative mx-auto flex h-18 w-18 items-center justify-center rounded-full ring-4 ring-card shadow-md">
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-18 w-18 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-hover text-xl font-extrabold text-primary-foreground shadow-xs">
                  {initials}
                </div>
              )}
            </div>

            <h3 className="mt-3 text-base font-bold tracking-tight text-foreground truncate px-2">
              {displayName}
            </h3>
            {contact.company && (
              <p className="mt-0.5 text-xs font-medium text-muted-foreground truncate">{contact.company}</p>
            )}

            {/* Phone & Email Action Cards */}
            <div className="mt-3.5 space-y-2">
              <button
                onClick={handleCopyPhone}
                type="button"
                className="group flex w-full items-center gap-2.5 rounded-xl border border-border/80 bg-card/90 px-3 py-2 text-xs font-medium text-foreground transition-all hover:bg-muted/70 hover:border-border shadow-xs"
              >
                <div className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Phone className="h-3.5 w-3.5" />
                </div>
                <span className="flex-1 text-left truncate font-semibold">
                  {contactHandle(contact)}
                </span>
                {copied ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </span>
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground/60 transition-colors group-hover:text-foreground shrink-0" />
                )}
              </button>

              {contact.email && (
                <div className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-card/90 px-3 py-2 text-xs font-medium text-muted-foreground shadow-xs">
                  <div className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                  </div>
                  <span className="truncate flex-1 text-left font-medium">{contact.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tags Section */}
          <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <TagIcon className="h-3.5 w-3.5 text-primary" />
                {tSidebar("tags")}
              </div>
              {tags.length > 0 && (
                <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {tags.length}
                </span>
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {tags.length === 0 ? (
                <p className="text-xs text-muted-foreground/75 italic">{tSidebar("noTags")}</p>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-xs ring-1 ring-inset"
                    style={{
                      backgroundColor: `${tag.color}15`,
                      color: tag.color,
                      borderColor: `${tag.color}35`,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Active Deals Section */}
          <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                {tSidebar("deals")}
              </div>
              {deals.length > 0 && (
                <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {deals.length}
                </span>
              )}
            </div>
            <div className="mt-2.5 space-y-2">
              {deals.length === 0 ? (
                <p className="text-xs text-muted-foreground/75 italic">{tSidebar("noDeals")}</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="group rounded-xl border border-border/70 bg-muted/30 p-3 transition-all hover:border-primary/40 hover:bg-muted/60 shadow-xs"
                  >
                    <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {deal.title}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="font-extrabold text-foreground">
                        {deal.currency ?? "$"}
                        {deal.value.toLocaleString()}
                      </span>
                      {deal.stage && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset"
                          style={{
                            backgroundColor: `${deal.stage.color}15`,
                            color: deal.stage.color,
                            borderColor: `${deal.stage.color}35`,
                          }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notes Section */}
          <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                {tSidebar("notes")}
              </div>
              {notes.length > 0 && (
                <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {notes.length}
                </span>
              )}
            </div>

            <div className="mt-2.5 space-y-3">
              {/* Note Input Composer */}
              <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-xs">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={tSidebar("addNotePlaceholder")}
                  rows={2}
                  className="w-full resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 outline-none leading-relaxed"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    className="h-7 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary-hover disabled:opacity-50"
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || addingNote}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {addingNote ? "Saving..." : "Add Note"}
                  </Button>
                </div>
              </div>

              {/* Notes Timeline List */}
              <div className="space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xl border border-border/60 bg-muted/30 p-3 shadow-xs"
                  >
                    <p className="whitespace-pre-wrap text-xs text-foreground/90 leading-relaxed font-normal">
                      {note.note_text}
                    </p>
                    <p className="mt-2 text-[10px] font-medium text-muted-foreground/75 tabular-nums">
                      {format(new Date(note.created_at), "MMM d, yyyy · HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
