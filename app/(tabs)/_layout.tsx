import { Tabs } from 'expo-router';
import { User, Search } from 'lucide-react-native';
import React from 'react';
import Colors from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';

export default function TabLayout() {
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: t.tabMyProfile,
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t.tabSearch,
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
