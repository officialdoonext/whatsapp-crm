"use client"

import { use, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2, ZapOff, ArrowLeft, Plus } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  AutomationBuilder,
  fromServerSteps,
  type BuilderInitial,
  type ServerStepNode,
} from "@/components/automations/automation-builder"
import type { AutomationTriggerType } from "@/types"

export default function EditAutomationPage({
  params,
}: {
  params?: Promise<{ id: string }> | { id: string }
}) {
  const routeParams = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations("Automations.edit")
  const [initial, setInitial] = useState<BuilderInitial | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Safely resolve id across both client-side hook and route prop
  let id = routeParams?.id
  if (!id && params) {
    if (typeof (params as any)?.then === "function") {
      try {
        const unwrapped = use(params as Promise<{ id: string }>)
        id = unwrapped?.id
      } catch {
        // non-fatal
      }
    } else {
      id = (params as any)?.id
    }
  }

  useEffect(() => {
    if (!id || id === "undefined") return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/automations/${id}`)
        if (!res.ok) {
          if (!cancelled) setError(t("loadError", { status: res.status }))
          return
        }
        const body = await res.json()
        if (cancelled) return
        if (!body.automation) {
          setError("Automation not found")
          return
        }
        setInitial({
          id: body.automation.id,
          name: body.automation.name ?? "",
          description: body.automation.description ?? "",
          trigger_type: body.automation.trigger_type as AutomationTriggerType,
          trigger_config: body.automation.trigger_config ?? {},
          is_active: !!body.automation.is_active,
          steps: fromServerSteps((body.steps ?? []) as ServerStepNode[]),
        })
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load automation")
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, t])

  if (error) {
    const isNotFound = error.includes("404") || error.toLowerCase().includes("not found")
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
        <div className="flex max-w-md w-full flex-col items-center text-center p-8 rounded-lg border border-border bg-card shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive mb-4">
            <ZapOff className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {isNotFound ? "Automation Not Found" : "Failed to Load Automation"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {isNotFound
              ? "This automation may have been deleted, moved, or you may not have permission to view it."
              : error}
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/automations")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("back")}
            </Button>
            <Button
              onClick={() => router.push("/automations/new")}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New Automation
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!initial) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return <AutomationBuilder initial={initial} />
}
