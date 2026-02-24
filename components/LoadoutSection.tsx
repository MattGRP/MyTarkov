import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Shield, Package } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { EquipmentItem, getItemImageURL } from '@/types/tarkov';
import { Language } from '@/constants/i18n';

interface LoadoutSectionProps {
  equippedItems: Record<string, EquipmentItem>;
}

const WEAPON_SLOTS = ['FirstPrimaryWeapon', 'SecondPrimaryWeapon', 'Holster', 'Scabbard'];
const GEAR_SLOTS = ['ArmorVest', 'TacticalVest', 'Backpack', 'SecuredContainer'];
const HEAD_SLOTS = ['Headwear', 'Earpiece', 'FaceCover', 'Eyewear'];

function getSlotLabel(slot: string, language: Language): string {
  const en: Record<string, string> = {
    FirstPrimaryWeapon: 'Primary',
    SecondPrimaryWeapon: 'Secondary',
    Holster: 'Sidearm',
    ArmorVest: 'Armor',
    TacticalVest: 'Rig',
    FaceCover: 'Face Cover',
    SecuredContainer: 'Secure',
    ArmBand: 'Armband',
  };
  const zh: Record<string, string> = {
    FirstPrimaryWeapon: '主武器',
    SecondPrimaryWeapon: '副武器',
    Holster: '手枪',
    ArmorVest: '护甲',
    TacticalVest: '战术背心',
    FaceCover: '面罩',
    SecuredContainer: '安全箱',
    ArmBand: '臂章',
    Headwear: '头盔',
    Earpiece: '耳机',
    Eyewear: '眼镜',
    Backpack: '背包',
    Scabbard: '近战武器',
  };
  if (language === 'zh') return zh[slot] ?? slot;
  return en[slot] ?? slot;
}

function EquipmentRow({ slot, item, isLast, language }: { slot: string; item: EquipmentItem; isLast: boolean; language: Language }) {
  const dur = item.upd?.Repairable?.Durability;
  const maxDur = item.upd?.Repairable?.MaxDurability;
  const hasDurability = dur !== undefined && maxDur !== undefined && maxDur > 0;
  const durRatio = hasDurability ? (dur! / maxDur!) : 0;
  const durColor = durRatio > 0.6 ? Colors.statGreen : durRatio > 0.3 ? Colors.statOrange : Colors.statRed;

  return (
    <View>
      <View style={styles.equipRow}>
        <View style={styles.itemImageWrap}>
          <Image
            source={{ uri: getItemImageURL(item._tpl) }}
            style={styles.itemImage}
            contentFit="contain"
          />
        </View>
        <View style={styles.equipInfo}>
          <Text style={styles.slotName}>{getSlotLabel(slot, language)}</Text>
          <Text style={styles.itemId} numberOfLines={1}>Item {item._tpl.slice(-8)}</Text>
          {hasDurability && (
            <View style={styles.durRow}>
              <View style={styles.durBarBg}>
                <View style={[styles.durBarFill, { width: `${durRatio * 100}%`, backgroundColor: durColor }]} />
              </View>
              <Text style={styles.durText}>{Math.round(dur!)}/{Math.round(maxDur!)}</Text>
            </View>
          )}
        </View>
      </View>
      {!isLast && <View style={styles.divider} />}
    </View>
  );
}

function SlotGroup({ slots, equippedItems, language }: { slots: string[]; equippedItems: Record<string, EquipmentItem>; language: Language }) {
  const activeSlots = slots.filter((s) => equippedItems[s]);
  if (activeSlots.length === 0) return null;

  return (
    <View style={styles.groupCard}>
      {activeSlots.map((slot, idx) => (
        <EquipmentRow
          key={slot}
          slot={slot}
          item={equippedItems[slot]}
          isLast={idx === activeSlots.length - 1}
          language={language}
        />
      ))}
    </View>
  );
}

export default React.memo(function LoadoutSection({ equippedItems }: LoadoutSectionProps) {
  const { t, language } = useLanguage();
  const hasItems = Object.keys(equippedItems).length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Package size={18} color={Colors.gold} />
        <Text style={styles.sectionTitle}>{t.loadout}</Text>
      </View>

      {!hasItems ? (
        <View style={styles.emptyCard}>
          <Shield size={28} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>{t.noLoadout}</Text>
        </View>
      ) : (
        <View style={styles.groupsWrap}>
          <SlotGroup slots={WEAPON_SLOTS} equippedItems={equippedItems} language={language} />
          <SlotGroup slots={GEAR_SLOTS} equippedItems={equippedItems} language={language} />
          <SlotGroup slots={HEAD_SLOTS} equippedItems={equippedItems} language={language} />
          {equippedItems['ArmBand'] && (
            <View style={styles.groupCard}>
              <EquipmentRow slot="ArmBand" item={equippedItems['ArmBand']} isLast language={language} />
            </View>
          )}
        </View>
      )}
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
  groupsWrap: {
    gap: 10,
  },
  groupCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  equipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  itemImageWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: 40,
    height: 40,
  },
  equipInfo: {
    flex: 1,
    gap: 2,
  },
  slotName: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  itemId: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  durRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  durBarBg: {
    width: 60,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
  },
  durBarFill: {
    height: 3,
    borderRadius: 2,
  },
  durText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 72,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
