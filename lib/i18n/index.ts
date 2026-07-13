import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { apiFetch } from '@/lib/api/client';
import en from './locales/en.json';
import ms from './locales/ms.json';

// English is the default for EVERYONE (locked decision) — no device-locale
// detection. Users switch manually (Profile / work-orders header / shift
// picker) and the choice sticks on this device + syncs to the backend so
// emails and pushes follow it.
const LOCALE_KEY = 'baiti.locale';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ms', label: 'Bahasa Melayu' },
] as const;

export type LocaleCode = (typeof LANGUAGES)[number]['code'];

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ms: { translation: ms },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },   // React already escapes
});

/** Apply the device's stored language choice on app boot. */
export async function loadStoredLocale(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(LOCALE_KEY);
    if (stored && stored !== i18n.language && LANGUAGES.some((l) => l.code === stored)) {
      await i18n.changeLanguage(stored);
    }
  } catch {
    // Storage unavailable — stay on English.
  }
}

/**
 * Switch language: instant UI change, persisted on device, best-effort
 * sync to the backend (emails + pushes follow the app language).
 */
export async function setLocale(code: LocaleCode): Promise<void> {
  await i18n.changeLanguage(code);
  await AsyncStorage.setItem(LOCALE_KEY, code);
  apiFetch('/api/v1/me/locale', {
    method: 'POST',
    body: JSON.stringify({ locale: code }),
  }).catch(() => {
    // Not logged in / offline — the toggle still works locally.
  });
}

/**
 * Called right after login/registration: pushes the language chosen on the
 * login screen (pre-auth, device-only) to the fresh account so emails and
 * pushes match from day one.
 */
export function syncLocaleAfterAuth(): void {
  apiFetch('/api/v1/me/locale', {
    method: 'POST',
    body: JSON.stringify({ locale: i18n.language }),
  }).catch(() => {});
}

export default i18n;
