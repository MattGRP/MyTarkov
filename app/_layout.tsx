import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { LanguageProvider } from '@/providers/LanguageProvider';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import { useRouter, useSegments } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, playerAccountId, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0] as string | undefined;
    const inAuthGroup = firstSegment === '(tabs)';
    const inLogin = firstSegment === 'login';
    const inSetup = firstSegment === 'setup';

    console.log('[AuthGate] isSignedIn:', isSignedIn, 'playerAccountId:', playerAccountId, 'segments:', segments);

    if (!isSignedIn) {
      if (!inLogin) {
        router.replace('/login' as never);
      }
    } else if (!playerAccountId) {
      if (!inSetup) {
        router.replace('/setup' as never);
      }
    } else {
      if (!inAuthGroup) {
        router.replace('/(tabs)/(home)' as never);
      }
    }
  }, [isSignedIn, playerAccountId, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <LanguageProvider>
          <AuthProvider>
            <AuthGate>
              <RootLayoutNav />
            </AuthGate>
          </AuthProvider>
        </LanguageProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
