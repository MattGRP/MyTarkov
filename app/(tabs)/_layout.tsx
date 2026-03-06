// noinspection JSUnusedGlobalSymbols
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Search, Settings, User } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors, { alphaBlack, getModeAccentTheme, withAlpha } from '@/constants/colors';
import { getDockBottomOffset, getDockReservedInset } from '@/constants/layout';
import { useGameMode } from '@/providers/GameModeProvider';
import { useLanguage } from '@/providers/LanguageProvider';

const VISIBLE_ROUTE_NAMES = new Set(['(home)', 'search', 'settings/index']);

function DockTabBar(props: BottomTabBarProps) {
  const { state, descriptors, navigation } = props;
  const insets = useSafeAreaInsets();
  const { gameMode } = useGameMode();

  const visibleRoutes = useMemo(
    () => state.routes.filter((route) => VISIBLE_ROUTE_NAMES.has(route.name)),
    [state.routes],
  );
  const accentTheme = useMemo(() => getModeAccentTheme(gameMode), [gameMode]);

  const modePalette = useMemo(() => {
    return {
      accent: accentTheme.accent,
      accentDim: withAlpha(accentTheme.accent, gameMode === 'pve' ? 0.60 : 0.56),
      accentSoft: gameMode === 'pve' ? accentTheme.accentSoft18 : accentTheme.accentSoft16,
      shellBorder: withAlpha(accentTheme.accent, gameMode === 'pve' ? 0.16 : 0.14),
      shellBackground: withAlpha(Colors.surface, 0.94),
    };
  }, [accentTheme, gameMode]);

  const shellPaddingBottom = 8;
  const dockBottomOffset = getDockBottomOffset(insets.bottom);

  return (
    <View pointerEvents="box-none" style={[styles.outerWrap, { paddingBottom: dockBottomOffset }]}>
      <View
        style={[
          styles.shell,
          {
            borderColor: modePalette.shellBorder,
            backgroundColor: modePalette.shellBackground,
            paddingBottom: shellPaddingBottom,
          },
        ]}
      >
        <View style={styles.tabRow}>
          {visibleRoutes.map((route) => {
            const routeIndex = state.routes.findIndex((entry) => entry.key === route.key);
            const isFocused = state.index === routeIndex;
            const options = descriptors[route.key].options;
            const label = typeof options.title === 'string' ? options.title : route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            const color = isFocused ? modePalette.accent : Colors.textTertiary;
            const iconNode = options.tabBarIcon?.({
              focused: isFocused,
              color,
              size: 19,
            });

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                style={[
                  styles.tabButton,
                  isFocused && {
                    borderWidth: 1,
                    borderColor: modePalette.accentDim,
                    backgroundColor: modePalette.accentSoft,
                  },
                ]}
              >
                <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>{iconNode}</View>
                <Text style={[styles.tabText, isFocused && { color: modePalette.accent }]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const sceneBottomInset = useMemo(() => getDockReservedInset(insets.bottom), [insets.bottom]);

  return (
    <Tabs
      tabBar={(props) => <DockTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: Colors.background,
          paddingBottom: sceneBottomInset,
        },
        tabBarBackground: () => <View style={styles.tabBarBackground} />,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          shadowColor: 'transparent',
        },
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
      <Tabs.Screen
        name="settings/index"
        options={{
          title: t.tabSettings,
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="tasks/index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarBackground: {
    backgroundColor: 'transparent',
  },
  outerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
    zIndex: 30,
    elevation: 0,
  },
  shell: {
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: alphaBlack(1),
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
    paddingTop: 8,
    paddingHorizontal: 8,
    gap: 7,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 7,
  },
  tabButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  iconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    transform: [{ scale: 1.04 }],
  },
  tabText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
});
