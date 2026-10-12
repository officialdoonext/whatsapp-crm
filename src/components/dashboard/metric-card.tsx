import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  /** Pre-formatted value for display (e.g. "42" or "$1,250"). */
  value: string
  icon: ComponentType<{ className?: string }>
  /**
   * Delta-mode secondary row: arrow + delta text. Omit when the metric
   * doesn't have a sensible comparison (e.g. total pipeline value).
   */
  delta?: {
    /** Positive / negative / zero drives arrow + color. */
    sign: number
    /** Pre-formatted delta, e.g. "+3 vs yesterday". */
    label: string
  }
  /** Used instead of `delta` when the metric has a static subtitle. */
  subtitle?: string
}

export function MetricCard({ title, value, icon: Icon, delta, subtitle }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-xs">
      <div className="flex items-start justify-between">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
        <div className="flex size-7 sm:size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-3.5 sm:size-4" />
        </div>
      </div>
      <p className="mt-2.5 text-2xl sm:text-[26px] leading-none font-bold tabular-nums text-foreground tracking-tight">
        {value}
      </p>
      {delta ? <DeltaRow sign={delta.sign} label={delta.label} /> : subtitle ? (
        <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  )
}

function DeltaRow({ sign, label }: { sign: number; label: string }) {
  const tone =
    sign > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : sign < 0
      ? 'text-red-500'
      : 'text-muted-foreground'
  const Arrow = sign > 0 ? ArrowUp : sign < 0 ? ArrowDown : Minus
  return (
    <div className={cn('mt-2 flex items-center gap-1 text-xs', tone)}>
      <Arrow className="size-3" aria-hidden />
      <span className="tabular-nums">{label}</span>
    </div>
  )
}
