'use client';

import { PasswordForm } from './password-form';
import { SessionsCard } from './sessions-card';
import { DeleteAccountCard } from './delete-account-card';
import { SettingsPanelHead } from './settings-panel-head';
import { useTranslations } from 'next-intl';

/**
 * "Login & security" section — groups password, active sessions,
 * and account deletion options.
 */
export function SecurityPanel() {
  const t = useTranslations('Settings.security');
  return (
    <section className="max-w-2xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title={t('title')}
        description={t('description')}
      />
      <div className="space-y-6">
        <PasswordForm />
        <SessionsCard />
        <DeleteAccountCard />
      </div>
    </section>
  );
}
