import { Stack } from 'expo-router';
import React from 'react';
import Colors from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';

export default function SearchLayout() {
  const { t } = useLanguage();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600' as const },
        contentStyle: { backgroundColor: Colors.background },
        headerBackTitle: t.back,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="item-types" options={{ headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="player" options={{ title: t.playerProfile }} />
      <Stack.Screen name="item/[id]" options={{ title: t.itemDetailsTitle }} />
      <Stack.Screen name="task/[id]" options={{ title: t.taskDetailsTitle }} />
      <Stack.Screen name="trader/[id]" options={{ title: t.traderDetailsTitle }} />
      <Stack.Screen name="boss/[id]" options={{ title: t.bossDetailsTitle }} />
    </Stack>
  );
}
