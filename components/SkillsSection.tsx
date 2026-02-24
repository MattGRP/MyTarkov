import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { SkillEntry } from '@/types/tarkov';
import { formatSkillName, getSkillColor } from '@/utils/helpers';

interface SkillsSectionProps {
  skills: SkillEntry[];
}

function SkillRow({ skill, isLast }: { skill: SkillEntry; isLast: boolean }) {
  const level = Math.floor(skill.Progress / 100);
  const progress = (skill.Progress % 100) / 100;
  const color = getSkillColor(skill.Id);

  return (
    <View>
      <View style={styles.skillRow}>
        <View style={[styles.skillDot, { backgroundColor: color }]} />
        <View style={styles.skillInfo}>
          <View style={styles.skillHeader}>
            <Text style={styles.skillName}>{formatSkillName(skill.Id)}</Text>
            <Text style={styles.skillLevel}>Lvl {level}</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
          </View>
        </View>
      </View>
      {!isLast && <View style={styles.divider} />}
    </View>
  );
}

export default React.memo(function SkillsSection({ skills }: SkillsSectionProps) {
  if (skills.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Star size={18} color={Colors.gold} />
        <Text style={styles.sectionTitle}>Skills</Text>
      </View>
      <View style={styles.card}>
        {skills.map((skill, idx) => (
          <SkillRow key={skill.Id} skill={skill} isLast={idx === skills.length - 1} />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 12,
  },
  skillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  skillInfo: {
    flex: 1,
    gap: 6,
  },
  skillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skillName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  skillLevel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 36,
  },
});
