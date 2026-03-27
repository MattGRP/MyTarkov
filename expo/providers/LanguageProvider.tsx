import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { Language, SUPPORTED_LANGUAGES, Translations, translations } from '@/constants/i18n';

const LANGUAGE_KEY = 'tarkov_language';

export const [LanguageProvider, useLanguage] = createContextHook(() => {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    let isActive = true;
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((stored) => {
        if (!isActive || !stored) return;
        if (SUPPORTED_LANGUAGES.includes(stored as Language)) {
          setLanguage(stored as Language);
        }
      })
      .catch((error) => {
        console.log('[Language] Failed to load language:', error);
      });
    return () => {
      isActive = false;
    };
  }, []);

  const updateLanguage = useCallback(async (next: Language) => {
    setLanguage(next);
    await AsyncStorage.setItem(LANGUAGE_KEY, next);
  }, []);

  const toggleLanguage = useCallback(async () => {
    const index = SUPPORTED_LANGUAGES.indexOf(language);
    const next = SUPPORTED_LANGUAGES[(index + 1) % SUPPORTED_LANGUAGES.length];
    await updateLanguage(next);
  }, [language, updateLanguage]);

  const nextLanguage = SUPPORTED_LANGUAGES[
    (SUPPORTED_LANGUAGES.indexOf(language) + 1) % SUPPORTED_LANGUAGES.length
  ];
  const t: Translations = translations[language];

  return { language, nextLanguage, setLanguage: updateLanguage, toggleLanguage, t };
});

