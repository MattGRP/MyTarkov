import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Language, Translations, translations } from '@/constants/i18n';

const LANGUAGE_KEY = 'tarkov_language';

export const [LanguageProvider, useLanguage] = createContextHook(() => {
  const [language, setLanguage] = useState<Language>('en');

  const storedLangQuery = useQuery({
    queryKey: ['stored-language'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
      return (stored as Language) || 'en';
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (storedLangQuery.data) {
      setLanguage(storedLangQuery.data);
    }
  }, [storedLangQuery.data]);

  const toggleLanguage = useCallback(async () => {
    const next: Language = language === 'en' ? 'zh' : 'en';
    setLanguage(next);
    await AsyncStorage.setItem(LANGUAGE_KEY, next);
    console.log('[Language] Switched to:', next);
  }, [language]);

  const t: Translations = translations[language];

  return { language, toggleLanguage, t };
});
