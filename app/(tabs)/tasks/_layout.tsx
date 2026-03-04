import { Stack } from 'expo-router';
import React from 'react';
import Colors from '@/constants/colors';
import { useGameMode } from '@/providers/GameModeProvider';
import { useLanguage } from '@/providers/LanguageProvider';

export default function TasksLayout() {
  const { t } = useLanguage();
  const { gameMode } = useGameMode();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerShadowVisible: false,
        headerTintColor: Colors.gold,
        headerTitleStyle: { fontWeight: '600' as const },
        contentStyle: { backgroundColor: Colors.background },
        headerBackTitle: gameMode === 'pve' ? t.back : t.back,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: t.taskDetailsTitle }} />
      <Stack.Screen name="item/[id]" options={{ title: t.itemDetailsTitle }} />
      <Stack.Screen name="trader/[id]" options={{ title: t.traderDetailsTitle }} />
    </Stack>
  );
}
