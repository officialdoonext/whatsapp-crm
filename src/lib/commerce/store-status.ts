export interface StoreStatusResult {
  isOpen: boolean;
  statusLabel: 'Online' | 'Offline';
  statusDescription: string;
  isManual: boolean;
  manualOverride: 'auto' | 'online' | 'offline';
  nextTransition?: string;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export function computeStoreStatus(store?: {
  manual_override?: 'auto' | 'online' | 'offline';
  opening_time?: string;
  closing_time?: string;
  working_days?: string[];
  is_online?: boolean;
} | null): StoreStatusResult {
  if (!store) {
    return {
      isOpen: false,
      statusLabel: 'Offline',
      statusDescription: 'No store configured',
      isManual: false,
      manualOverride: 'offline',
    };
  }

  const override = store.manual_override || 'auto';

  // Explicit manual overrides
  if (override === 'online') {
    return {
      isOpen: true,
      statusLabel: 'Online',
      statusDescription: 'Force Online (Manual override)',
      isManual: true,
      manualOverride: 'online',
    };
  }

  if (override === 'offline') {
    return {
      isOpen: false,
      statusLabel: 'Offline',
      statusDescription: 'Force Offline (Temporarily paused)',
      isManual: true,
      manualOverride: 'offline',
    };
  }

  // Automatic schedule calculation based on operating hours and working days
  const now = new Date();
  const currentDayIndex = now.getDay();
  const currentDayName = DAY_NAMES[currentDayIndex];

  const workingDays = (store.working_days && store.working_days.length > 0)
    ? store.working_days.map((d) => d.toLowerCase())
    : [...DAY_NAMES];

  const isWorkingDay = workingDays.includes(currentDayName);

  const openTime = store.opening_time || '09:00';
  const closeTime = store.closing_time || '22:00';

  const [openH, openM] = openTime.split(':').map((v) => parseInt(v, 10) || 0);
  const [closeH, closeM] = closeTime.split(':').map((v) => parseInt(v, 10) || 0);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  let isOpen = false;

  if (!isWorkingDay) {
    return {
      isOpen: false,
      statusLabel: 'Offline',
      statusDescription: `Closed today (${currentDayName.charAt(0).toUpperCase() + currentDayName.slice(1)})`,
      isManual: false,
      manualOverride: 'auto',
      nextTransition: `Re-opens on next working day at ${openTime}`,
    };
  }

  if (openMinutes === closeMinutes) {
    // 24 hours open
    isOpen = true;
  } else if (closeMinutes > openMinutes) {
    // Standard daytime schedule (e.g. 09:00 - 22:00)
    isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } else {
    // Overnight schedule (e.g. 18:00 - 02:00 next day)
    isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }

  const formatTime12h = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10) || 0);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    const displayM = m < 10 ? `0${m}` : m;
    return `${displayH}:${displayM} ${suffix}`;
  };

  if (isOpen) {
    return {
      isOpen: true,
      statusLabel: 'Online',
      statusDescription: `Open now • Closes at ${formatTime12h(closeTime)}`,
      isManual: false,
      manualOverride: 'auto',
      nextTransition: `Closes at ${formatTime12h(closeTime)}`,
    };
  } else {
    return {
      isOpen: false,
      statusLabel: 'Offline',
      statusDescription: `Closed now • Opens at ${formatTime12h(openTime)}`,
      isManual: false,
      manualOverride: 'auto',
      nextTransition: `Opens at ${formatTime12h(openTime)}`,
    };
  }
}
