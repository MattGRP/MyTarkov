import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crosshair, ChevronRight } from 'lucide-react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const { continueAsGuest } = useAuth();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#0F0E0A', '#1A1812', '#15140F', '#0F0E0A']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <View style={styles.content}>
        <View style={styles.spacer} />

        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <View style={styles.iconRing}>
              <Crosshair size={56} color={Colors.gold} strokeWidth={1} />
            </View>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.subtitle}>ESCAPE FROM TARKOV</Text>
            <Text style={styles.title}>Player Stats</Text>
          </View>

          <Text style={styles.description}>
            Track your raids, K/D ratio, survival rate,{'\n'}and skills progression.
          </Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.guestButton}
            onPress={continueAsGuest}
            activeOpacity={0.8}
            testID="continue-guest-button"
          >
            <LinearGradient
              colors={[Colors.gold, '#C4A84D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.guestButtonGradient}
            >
              <Text style={styles.guestButtonText}>Get Started</Text>
              <ChevronRight size={20} color="#1A1A14" />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            View any player&#39;s stats from tarkov.dev
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0E0A',
  },
  decorCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(217,191,115,0.03)',
    top: -80,
    right: -100,
  },
  decorCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(217,191,115,0.02)',
    bottom: 100,
    left: -60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  spacer: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    gap: 24,
  },
  iconContainer: {
    marginBottom: 8,
  },
  iconRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderColor: 'rgba(217,191,115,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217,191,115,0.04)',
  },
  titleBlock: {
    alignItems: 'center',
    gap: 8,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.gold,
    letterSpacing: 3,
  },
  title: {
    fontSize: 34,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  description: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomSection: {
    paddingBottom: 60,
    gap: 16,
    alignItems: 'center',
  },
  guestButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  guestButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  guestButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#1A1A14',
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
  },
});
