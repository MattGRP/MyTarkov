import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Globe } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';

export default function SettingsScreen() {
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t.settingsTitle}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.language}</Text>
        <TouchableOpacity style={styles.rowButton} onPress={toggleLanguage} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Globe size={18} color={Colors.gold} />
            <Text style={styles.rowLabel}>{language === 'en' ? t.languageValueEn : t.languageValueZh}</Text>
          </View>
          <Text style={styles.rowValue}>{language === 'en' ? 'EN' : '中文'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  rowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabel: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  rowValue: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
});
