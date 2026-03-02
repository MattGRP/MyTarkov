import { Stack } from 'expo-router';
import React from 'react';
import Colors from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';

export default function TasksLayout() {
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
      <Stack.Screen name="[id]" options={{ title: t.taskDetailsTitle }} />
      <Stack.Screen name="item/[id]" options={{ title: t.itemDetailsTitle }} />
      <Stack.Screen name="trader/[id]" options={{ title: t.traderDetailsTitle }} />
    </Stack>
  );
}
