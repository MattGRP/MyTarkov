import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/providers/LanguageProvider';
import { fetchTaskSummaries } from '@/services/tarkovApi';
import type { TaskDetail } from '@/types/tarkov';

const TASKS_STALE_TIME_MS = 30 * 60 * 1000;
const TASK_FETCH_PAGE_SIZE = 80;

export default function TasksBootstrap() {
  const queryClient = useQueryClient();
  const { language } = useLanguage();

  useEffect(() => {
    void queryClient.prefetchInfiniteQuery({
      queryKey: ['tasks-paged', language],
      initialPageParam: 0,
      queryFn: ({ signal, pageParam }) => fetchTaskSummaries(language, {
        signal,
        priority: 'background',
        limit: TASK_FETCH_PAGE_SIZE,
        offset: pageParam,
      }),
      getNextPageParam: (lastPage: TaskDetail[], allPages: TaskDetail[][]) => {
        if (lastPage.length < TASK_FETCH_PAGE_SIZE) return undefined;
        return allPages.reduce((sum: number, page: TaskDetail[]) => sum + page.length, 0);
      },
      staleTime: TASKS_STALE_TIME_MS,
    });
  }, [language, queryClient]);

  return null;
}
