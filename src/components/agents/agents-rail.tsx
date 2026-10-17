'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Settings2, BarChart3, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AgentTab = 'playground' | 'setup' | 'usage';

export interface AiConfigSummary {
  configured?: boolean;
  provider?: string;
  model?: string;
  is_active?: boolean;
  auto_reply_enabled?: boolean;
}

const RAIL_DESKTOP_MIN_PX = 1024;

interface AgentsRailProps {
  active: AgentTab;
  onSelect: (tab: AgentTab) => void;
  canViewUsage: boolean;
  hints?: Partial<Record<AgentTab, ReactNode>>;
  configSummary?: AiConfigSummary | null;
}

interface RailItem {
  id: AgentTab;
  label: string;
  icon: typeof Sparkles;
}

interface RailGroup {
  group: string;
  label?: string;
  items: RailItem[];
}

export function AgentsRail({
  active,
  onSelect,
  canViewUsage,
  hints,
  configSummary,
}: AgentsRailProps) {
  const t = useTranslations('Agents');
  const activeRef = useRef<HTMLButtonElement>(null);

  // When horizontal (mobile), keep the active chip in view.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia(`(min-width: ${RAIL_DESKTOP_MIN_PX}px)`).matches) return;
    activeRef.current?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [active]);

  const groups: RailGroup[] = [
    {
      group: 'agent',
      label: 'Agent',
      items: [
        {
          id: 'playground',
          label: t('tabPlayground'),
          icon: Sparkles,
        },
        {
          id: 'setup',
          label: t('tabSetup'),
          icon: Settings2,
        },
      ],
    },
    ...(canViewUsage
      ? [
          {
            group: 'analytics',
            label: 'Analytics',
            items: [
              {
                id: 'usage' as AgentTab,
                label: t('tabUsage'),
                icon: BarChart3,
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <nav
      aria-label="AI Agent navigation"
      className={cn(
        'flex gap-1 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'border-b border-border',
        'lg:sticky lg:top-0 lg:flex-col lg:overflow-visible lg:border-b-0 lg:pb-0',
      )}
    >
      {groups.map(({ label, group, items }) => (
        <div key={group} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
          {label ? (
            <div className="hidden px-3 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase lg:block">
              {label}
            </div>
          ) : null}

          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                ref={isActive ? activeRef : undefined}
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13.5px] font-medium whitespace-nowrap transition-colors cursor-pointer',
                  'lg:w-full',
                  isActive
                    ? 'bg-muted text-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'size-4 shrink-0',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {hints?.[item.id] != null ? (
                  <span
                    className={cn(
                      'hidden items-center gap-1.5 text-xs lg:inline-flex',
                      isActive ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {hints[item.id]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ))}

      {/* Subtle agent info badge on desktop */}
      {configSummary?.configured && (
        <div className="hidden mt-6 px-3 py-2.5 rounded-lg border border-border/60 bg-muted/30 text-xs text-muted-foreground lg:block">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Bot className="h-3.5 w-3.5 text-primary" />
            <span>AI Status</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span>Model:</span>
            <span className="font-mono text-foreground truncate max-w-[110px]">
              {configSummary.model || '—'}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span>Auto-reply:</span>
            <span
              className={cn(
                'font-medium',
                configSummary.auto_reply_enabled
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground',
              )}
            >
              {configSummary.auto_reply_enabled ? 'Enabled' : 'Off'}
            </span>
          </div>
        </div>
      )}
    </nav>
  );
}
