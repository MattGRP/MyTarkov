import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Colors from '@/constants/colors';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { GameModeProvider, useGameMode } from '@/providers/GameModeProvider';
import { LanguageProvider } from '@/providers/LanguageProvider';
import PlayerSearchTokenBootstrap from '@/components/PlayerSearchTokenBootstrap';
import TasksBootstrap from '@/components/TasksBootstrap';
import FullscreenSkeleton from '@/components/FullscreenSkeleton';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  const { isLoadingGameMode } = useGameMode();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading || isLoadingGameMode) return;

    const firstSegment = segments[0] as string | undefined;
    const inTabs = firstSegment === '(tabs)';

    if (!inTabs) {
      router.replace('/(tabs)/(home)' as never);
    }
  }, [isLoading, isLoadingGameMode, segments, router]);

  if (isLoading || isLoadingGameMode) {
    return (
      <FullscreenSkeleton />
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

function ThemedRootShell({ children }: { children: React.ReactNode }) {
  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: Colors.background }}
    >
      {children}
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <GameModeProvider>
          <ThemedRootShell>
            <AuthProvider>
              <AuthGate>
                <PlayerSearchTokenBootstrap />
                <TasksBootstrap />
                <RootLayoutNav />
              </AuthGate>
            </AuthProvider>
          </ThemedRootShell>
        </GameModeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
