import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/providers/LanguageProvider';
import { fetchTasks } from '@/services/tarkovApi';

const TASKS_STALE_TIME_MS = 30 * 60 * 1000;

export default function TasksBootstrap() {
  const queryClient = useQueryClient();
  const { language } = useLanguage();

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ['tasks', language],
      queryFn: () => fetchTasks(language),
      staleTime: TASKS_STALE_TIME_MS,
    });
  }, [language, queryClient]);

  return null;
}

