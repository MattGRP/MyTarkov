import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';

export default function NotFoundScreen() {
  const { t } = useLanguage();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>{t.notFoundTitle}</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>{t.notFoundLink}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: Colors.text,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: Colors.gold,
  },
});
