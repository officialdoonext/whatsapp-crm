"use client"

import Link from 'next/link'
import { UserPlus, Briefcase, Radio, Zap, ArrowUpRight } from 'lucide-react'
import type { ComponentType } from 'react'

import { useTranslations } from 'next-intl'

interface Action {
  labelKey: string
  href: string
  icon: ComponentType<{ className?: string }>
  tint: string
  glowColor: string
}

const ACTIONS: Action[] = [
  { labelKey: 'newContact', href: '/contacts', icon: UserPlus, tint: 'text-emerald-500 bg-emerald-500/10 ring-emerald-500/20', glowColor: 'hover:border-emerald-500/40 hover:shadow-emerald-500/5' },
  { labelKey: 'newDeal', href: '/pipelines', icon: Briefcase, tint: 'text-blue-500 bg-blue-500/10 ring-blue-500/20', glowColor: 'hover:border-blue-500/40 hover:shadow-blue-500/5' },
  { labelKey: 'newBroadcast', href: '/broadcasts/new', icon: Radio, tint: 'text-amber-500 bg-amber-500/10 ring-amber-500/20', glowColor: 'hover:border-amber-500/40 hover:shadow-amber-500/5' },
  { labelKey: 'newAutomation', href: '/automations/new', icon: Zap, tint: 'text-purple-500 bg-purple-500/10 ring-purple-500/20', glowColor: 'hover:border-purple-500/40 hover:shadow-purple-500/5' },
]

export function QuickActions() {
  const t = useTranslations('Dashboard.quickActions')
  
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTIONS.map((a) => {
        const Icon = a.icon
        return (
          <Link
            key={a.href}
            href={a.href}
            className={`group relative flex items-center justify-between rounded-xl border border-border/70 bg-gradient-to-b from-card to-card/90 px-3.5 py-3 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${a.glowColor}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex size-8.5 shrink-0 items-center justify-center rounded-lg ring-1 transition-transform duration-200 group-hover:scale-110 ${a.tint}`}>
                <Icon className="size-4" />
              </div>
              <span className="truncate text-xs sm:text-sm font-semibold text-foreground/90 group-hover:text-foreground">
                {t(a.labelKey as string)}
              </span>
            </div>
            <ArrowUpRight className="size-3.5 text-muted-foreground/40 opacity-0 -translate-x-1 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-foreground shrink-0 ml-1.5" />
          </Link>
        )
      })}
    </div>
  )
}
