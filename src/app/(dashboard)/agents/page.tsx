'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AiPlayground } from '@/components/agents/ai-playground';
import { AiUsageCard } from '@/components/agents/ai-usage';
import { AiConfig } from '@/components/settings/ai-config';
import {
  AgentsRail,
  type AgentTab,
  type AiConfigSummary,
} from '@/components/agents/agents-rail';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';

export default function AgentsPage() {
  return (
    <Suspense fallback={null}>
      <AgentsPageInner />
    </Suspense>
  );
}

function AgentsPageInner() {
  const t = useTranslations('Agents');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accountRole } = useAuth();
  const canViewUsage = accountRole ? canEditSettings(accountRole) : false;

  const urlTab = searchParams.get('tab') as AgentTab | null;
  const initialTab: AgentTab =
    urlTab === 'playground' || urlTab === 'setup' || (urlTab === 'usage' && canViewUsage)
      ? urlTab
      : 'playground';

  const [tab, setTab] = useState<AgentTab>(initialTab);
  const [decided, setDecided] = useState(false);
  const [configSummary, setConfigSummary] = useState<AiConfigSummary | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/config');
      const data = await res.json().catch(() => ({}));
      setConfigSummary({
        configured: Boolean(data?.configured),
        provider: data?.provider,
        model: data?.model,
        is_active: data?.is_active,
        auto_reply_enabled: data?.auto_reply_enabled,
      });
      return data;
    } catch {
      setConfigSummary({ configured: false });
      return null;
    }
  }, []);

  // Land first-time users without a URL param on Setup, returning users on Playground.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchConfig();
      if (cancelled) return;

      if (!urlTab) {
        setTab(data?.configured ? 'playground' : 'setup');
      }
      setDecided(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchConfig, urlTab]);

  const handleSelectTab = (nextTab: AgentTab) => {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', nextTab);
    router.replace(`/agents?${params.toString()}`, { scroll: false });
  };

  const hints: Partial<Record<AgentTab, ReactNode>> = useMemo(
    () => ({
      setup: configSummary?.configured ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Ready
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Setup
        </span>
      ),
    }),
    [configSummary],
  );

  const panel: Record<AgentTab, ReactNode> = {
    playground: (
      <AiPlayground onGoToSetup={() => handleSelectTab('setup')} />
    ),
    setup: (
      <AiConfig onSaved={() => void fetchConfig()} />
    ),
    usage: canViewUsage ? <AiUsageCard /> : null,
  };

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('description')}
        </p>
      </div>

      {decided && (
        <div className="mt-6 grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-start">
          <div className="lg:border-r lg:border-border lg:pr-6">
            <AgentsRail
              active={tab}
              onSelect={handleSelectTab}
              canViewUsage={canViewUsage}
              hints={hints}
              configSummary={configSummary}
            />
          </div>
          <div className="min-w-0">{panel[tab]}</div>
        </div>
      )}
    </div>
  );
}
