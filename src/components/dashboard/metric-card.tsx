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
    <div className="group relative overflow-hidden rounded-xl border border-border/70 bg-gradient-to-b from-card to-card/90 p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md">
      {/* Subtle top ambient accent line on hover */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="flex items-start justify-between">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground tracking-tight">{title}</p>
        <div className="flex size-8 sm:size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 transition-transform duration-200 group-hover:scale-105">
          <Icon className="size-4 sm:size-4.5" />
        </div>
      </div>
      <p className="mt-2.5 text-2xl sm:text-[28px] leading-tight font-extrabold tabular-nums text-foreground tracking-tight">
        {value}
      </p>
      {delta ? <DeltaRow sign={delta.sign} label={delta.label} /> : subtitle ? (
        <p className="mt-2 text-xs font-medium text-muted-foreground/80">{subtitle}</p>
      ) : null}
    </div>
  )
}

function DeltaRow({ sign, label }: { sign: number; label: string }) {
  const tone =
    sign > 0
      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 ring-emerald-500/20'
      : sign < 0
      ? 'text-rose-500 dark:text-rose-400 bg-rose-500/10 ring-rose-500/20'
      : 'text-muted-foreground bg-muted/60 ring-border/50'
  const Arrow = sign > 0 ? ArrowUp : sign < 0 ? ArrowDown : Minus
  return (
    <div className="mt-2 flex items-center">
      <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', tone)}>
        <Arrow className="size-3" aria-hidden />
        <span className="tabular-nums">{label}</span>
      </span>
    </div>
  )
}
