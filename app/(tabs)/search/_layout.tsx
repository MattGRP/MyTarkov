import { Stack } from 'expo-router';
import React from 'react';
import Colors from '@/constants/colors';

export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600' as const },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="player" options={{ title: 'Player Profile' }} />
    </Stack>
  );
}
