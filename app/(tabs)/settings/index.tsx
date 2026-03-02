import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import { Globe } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import PageHeader, { getPageHeaderEstimatedHeight } from '@/components/PageHeader';
import AccountBindingPanel from '@/components/AccountBindingPanel';
import { getDebugLogsText } from '@/utils/debugLog';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { nextLanguage, toggleLanguage, t, language } = useLanguage();
  const l = useCallback((zh: string, en: string, ru: string) => {
    if (language === 'zh') return zh;
    if (language === 'ru') return ru;
    return en;
  }, [language]);
  const sectionGap = 12;
  const contentTopGap = 10;
  const scrollRef = useRef<ScrollView>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(() => getPageHeaderEstimatedHeight(insets.top, true));
  const [bindPanelOffsetY, setBindPanelOffsetY] = useState(0);
  const [isExportingLogs, setIsExportingLogs] = useState(false);
  const nextLanguageLabel = nextLanguage === 'zh'
    ? t.languageValueZh
    : nextLanguage === 'ru'
      ? t.languageValueRu
      : t.languageValueEn;
  const nextLanguageCode = nextLanguage.toUpperCase();

  const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next > 0 && Math.abs(next - headerHeight) > 1) {
      setHeaderHeight(next);
    }
  }, [headerHeight]);

  const handleBindWrapLayout = useCallback((event: LayoutChangeEvent) => {
    setBindPanelOffsetY(Math.max(0, Math.round(event.nativeEvent.layout.y)));
  }, []);

  const handleSearchInputFocus = useCallback((inputOffsetYInPanel: number) => {
    const targetY = Math.max(0, bindPanelOffsetY + inputOffsetYInPanel - headerHeight - 8);
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: targetY, animated: true });
      }, 36);
    });
  }, [bindPanelOffsetY, headerHeight]);

  const handleExportLogs = useCallback(async () => {
    if (isExportingLogs) return;
    setIsExportingLogs(true);
    try {
      const logs = await getDebugLogsText();
      const report = [
        'MyTarkov Debug Logs',
        `Generated: ${new Date().toISOString()}`,
        `Platform: ${Platform.OS}`,
        '----------------',
        logs,
      ].join('\n');
      await Share.share({
        title: 'MyTarkov Logs',
        message: report,
      });
    } catch (error) {
      Alert.alert(
        l('导出日志失败', 'Failed to export logs', 'Не удалось экспортировать логи'),
        (error as Error)?.message || l('请稍后重试。', 'Please try again later.', 'Попробуйте еще раз позже.'),
      );
    } finally {
      setIsExportingLogs(false);
    }
  }, [isExportingLogs, l]);

  const handleContactAuthor = useCallback(async () => {
    const mail = 'grp20030321@icloud.com';
    const subject = encodeURIComponent('MyTarkov Feedback');
    const body = encodeURIComponent(
      l(
        '你好，我想反馈一个问题：\n\n（建议先在设置里导出日志并粘贴关键内容）',
        'Hi, I would like to report an issue:\n\n(Please export logs in Settings and paste key details.)',
        'Здравствуйте, хочу сообщить о проблеме:\n\n(Сначала экспортируйте логи в Настройках и вставьте ключевые детали.)',
      ),
    );
    const url = `mailto:${mail}?subject=${subject}&body=${body}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert(
        l('无法打开邮箱应用', 'Unable to open mail app', 'Не удалось открыть почтовое приложение'),
        mail,
      );
      return;
    }
    await Linking.openURL(url);
  }, [l]);

  return (
    <View style={styles.container}>
      <PageHeader
        title={t.settingsTitle}
        subtitle={t.searchHeaderSubtitle}
        fixed
        onLayout={handleHeaderLayout}
      />
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + contentTopGap,
            paddingBottom: Math.max(insets.bottom + 28, 36),
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentInsetAdjustmentBehavior="never"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.language}</Text>
          <TouchableOpacity style={styles.rowButton} onPress={toggleLanguage} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <Globe size={18} color={Colors.gold} />
              <Text style={styles.rowLabel}>{nextLanguageLabel}</Text>
            </View>
            <Text style={styles.rowValue}>{nextLanguageCode}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.bindWrap, { marginTop: sectionGap }]} onLayout={handleBindWrapLayout}>
          <AccountBindingPanel onSearchInputFocus={handleSearchInputFocus} />
        </View>

        <View style={[styles.section, { marginTop: sectionGap }]}>
          <Text style={styles.sectionTitle}>{l('反馈与排查', 'Feedback & Diagnostics', 'Обратная связь и диагностика')}</Text>
          <TouchableOpacity style={styles.rowButton} onPress={handleExportLogs} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>{isExportingLogs ? l('导出中...', 'Exporting...', 'Экспорт...') : l('导出日志', 'Export Logs', 'Экспорт логов')}</Text>
            </View>
            <Text style={styles.rowValue}>{l('共享', 'Share', 'Поделиться')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rowButton} onPress={handleContactAuthor} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>{l('联系作者', 'Contact Author', 'Связаться с автором')}</Text>
            </View>
            <Text style={styles.rowValue}>grp20030321@icloud.com</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 0,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 20,
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
  bindWrap: {
    marginHorizontal: 20,
    alignItems: 'center',
  },
});
