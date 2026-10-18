import React, { createContext, useContext, useState } from 'react';

import de from './locales/de.json';
import en from './locales/en.json';
import sw from './locales/sw.json';

export type Language = 'de' | 'en' | 'sw';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  languages: { code: Language; label: string; flag: string }[];
}

const translations: Record<Language, any> = { de, en, sw };

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('kenia_rms_lang') as Language;
    return saved && translations[saved] ? saved : 'de';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('kenia_rms_lang', lang);
  };

  const t = (path: string, params?: Record<string, string | number>): string => {
    const keys = path.split('.');
    
    // 1. Try current language
    let value: any = translations[language];
    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        value = undefined;
        break;
      }
    }

    // 2. Fallback to English if missing
    if (value === undefined && language !== 'en') {
      let fallbackValue: any = translations.en;
      for (const key of keys) {
        if (fallbackValue && typeof fallbackValue === 'object') {
          fallbackValue = fallbackValue[key];
        } else {
          fallbackValue = undefined;
          break;
        }
      }
      value = fallbackValue;
    }

    // 3. Fallback to path key itself
    if (value === undefined || typeof value !== 'string') {
      return path;
    }

    // Interpolate params: e.g. {name} or {amount}
    if (params) {
      for (const [pKey, pVal] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
      }
    }

    return value;
  };

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'sw', label: 'Kiswahili', flag: '🇰🇪' }
  ];

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, languages }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
