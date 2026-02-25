import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Shield, Package } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { EquipmentItem, getItemImageURL } from '@/types/tarkov';
import { fetchItemMetaByTpls } from '@/services/tarkovApi';

interface LoadoutSectionProps {
  equippedItems: Record<string, EquipmentItem>;
  equipmentItems: EquipmentItem[];
}

const WEAPON_SLOTS = ['FirstPrimaryWeapon', 'SecondPrimaryWeapon', 'Holster', 'Scabbard'];
const GEAR_SLOTS = ['ArmorVest', 'TacticalVest', 'Backpack', 'SecuredContainer'];
const HEAD_SLOTS = ['Headwear', 'Earpiece', 'FaceCover', 'Eyewear'];

const GRID_CELL_PX = 48;
const GRID_MAX_PX = 168;

function getGridSize(meta?: { width?: number; height?: number }) {
  const width = Math.max(1, meta?.width ?? 1);
  const height = Math.max(1, meta?.height ?? 1);
  const rawWidth = width * GRID_CELL_PX;
  const rawHeight = height * GRID_CELL_PX;
  const scale = Math.min(1, GRID_MAX_PX / Math.max(rawWidth, rawHeight));
  return {
    width,
    height,
    displayWidth: Math.round(rawWidth * scale),
    displayHeight: Math.round(rawHeight * scale),
    cellSize: Math.round(GRID_CELL_PX * scale),
  };
}

function getItemImageSource(tpl: string, meta?: { baseImageLink?: string; width?: number; height?: number }) {
  if (meta?.baseImageLink && (meta.width ?? 1) * (meta.height ?? 1) > 1) {
    return meta.baseImageLink;
  }
  return getItemImageURL(tpl);
}

function ItemGridImage({ tpl, meta }: { tpl: string; meta?: { baseImageLink?: string; width?: number; height?: number } }) {
  const grid = getGridSize(meta);
  const showGrid = grid.width > 1 || grid.height > 1;
  const vLines = Array.from({ length: grid.width + 1 }, (_, i) => i);
  const hLines = Array.from({ length: grid.height + 1 }, (_, i) => i);

  return (
    <View style={[styles.itemImageWrap, { width: grid.displayWidth, height: grid.displayHeight }]}>
      <Image
        source={{ uri: getItemImageSource(tpl, meta) }}
        style={[styles.itemImage, { width: grid.displayWidth, height: grid.displayHeight }]}
        contentFit="contain"
        contentPosition="center"
      />
      {showGrid && (
        <View style={styles.gridOverlay} pointerEvents="none">
          {vLines.map((idx) => (
            <View
              key={`v-${idx}`}
              style={[styles.gridLineVertical, { left: Math.round(idx * grid.cellSize) }]}
            />
          ))}
          {hLines.map((idx) => (
            <View
              key={`h-${idx}`}
              style={[styles.gridLineHorizontal, { top: Math.round(idx * grid.cellSize) }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function getSlotLabel(slot: string, t: ReturnType<typeof useLanguage>['t']): string {
  const map: Record<string, string> = {
    FirstPrimaryWeapon: t.slotPrimary,
    SecondPrimaryWeapon: t.slotSecondary,
    Holster: t.slotSidearm,
    Scabbard: t.slotScabbard,
    ArmorVest: t.slotArmor,
    TacticalVest: t.slotRig,
    Backpack: t.slotBackpack,
    SecuredContainer: t.slotSecure,
    ArmBand: t.slotArmband,
    Headwear: t.slotHeadwear,
    Earpiece: t.slotEarpiece,
    FaceCover: t.slotFaceCover,
    Eyewear: t.slotEyewear,
  };
  return map[slot] ?? slot;
}

function EquipmentRow({
  slot,
  item,
  isLast,
  itemMeta,
  t,
  level,
  hasChildren,
  expanded,
  onToggle,
}: {
  slot: string;
  item: EquipmentItem;
  isLast: boolean;
  itemMeta?: { name: string; width?: number; height?: number; baseImageLink?: string };
  t: ReturnType<typeof useLanguage>['t'];
  level: number;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const dur = item.upd?.Repairable?.Durability;
  const maxDur = item.upd?.Repairable?.MaxDurability;
  const hasDurability = dur !== undefined && maxDur !== undefined && maxDur > 0;
  const durRatio = hasDurability ? (dur! / maxDur!) : 0;
  const durColor = durRatio > 0.6 ? Colors.statGreen : durRatio > 0.3 ? Colors.statOrange : Colors.statRed;
  const sizeLabel = itemMeta?.width && itemMeta?.height ? `${itemMeta.width}x${itemMeta.height}` : undefined;

  return (
    <View>
      <TouchableOpacity
        style={[styles.equipRow, level > 0 && { paddingLeft: 12 + level * 14 }]}
        activeOpacity={hasChildren ? 0.7 : 1}
        onPress={hasChildren ? onToggle : undefined}
      >
        <ItemGridImage tpl={item._tpl} meta={itemMeta} />
        <View style={styles.equipInfo}>
          <View style={styles.slotRow}>
            <Text style={styles.slotName}>{getSlotLabel(slot, t)}</Text>
            {sizeLabel && <Text style={styles.sizeText}>{sizeLabel}</Text>}
          </View>
          <Text style={styles.itemId} numberOfLines={1}>{itemMeta?.name || `Item ${item._tpl.slice(-8)}`}</Text>
          {hasDurability && (
            <View style={styles.durRow}>
              <View style={styles.durBarBg}>
                <View style={[styles.durBarFill, { width: `${durRatio * 100}%`, backgroundColor: durColor }]} />
              </View>
              <Text style={styles.durText}>{Math.round(dur!)}/{Math.round(maxDur!)}</Text>
            </View>
          )}
        </View>
        {hasChildren && (
          <Text style={styles.expandIcon}>{expanded ? '▾' : '▸'}</Text>
        )}
      </TouchableOpacity>
      {!isLast && <View style={[styles.divider, level > 0 && { marginLeft: 72 + level * 14 }]} />}
    </View>
  );
}

function SlotGroup({
  slots,
  equippedItems,
  itemMetaMap,
  t,
  childrenByParent,
  expandedIds,
  onToggle,
}: {
  slots: string[];
  equippedItems: Record<string, EquipmentItem>;
  itemMetaMap: Record<string, { name: string; width?: number; height?: number; baseImageLink?: string }>;
  t: ReturnType<typeof useLanguage>['t'];
  childrenByParent: Record<string, EquipmentItem[]>;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const activeSlots = slots.filter((s) => equippedItems[s]);
  if (activeSlots.length === 0) return null;

  const renderChildren = (parentId: string, level: number, slot: string, visited: Set<string>): React.ReactNode => {
    const children = childrenByParent[parentId] ?? [];
    if (children.length === 0) return null;
    if (!expandedIds.has(parentId)) return null;
    return children.map((child, idx) => {
      if (visited.has(child._id)) return null;
      const childVisited = new Set(visited);
      childVisited.add(child._id);
      const hasChildren = (childrenByParent[child._id] ?? []).length > 0;
      return (
        <View key={child._id}>
          <EquipmentRow
            slot={slot}
            item={child}
            itemMeta={itemMetaMap[child._tpl]}
            t={t}
            level={level}
            hasChildren={hasChildren}
            expanded={expandedIds.has(child._id)}
            onToggle={() => onToggle(child._id)}
            isLast={idx === children.length - 1 && !hasChildren}
          />
          {renderChildren(child._id, level + 1, slot, childVisited)}
        </View>
      );
    });
  };

  return (
    <View style={styles.groupCard}>
      {activeSlots.map((slot, idx) => {
        const item = equippedItems[slot];
        const hasChildren = (childrenByParent[item._id] ?? []).length > 0;
        return (
          <View key={slot}>
            <EquipmentRow
              slot={slot}
              item={item}
              itemMeta={itemMetaMap[item._tpl]}
              t={t}
              level={0}
              hasChildren={hasChildren}
              expanded={expandedIds.has(item._id)}
              onToggle={() => onToggle(item._id)}
              isLast={idx === activeSlots.length - 1 && !hasChildren}
            />
            {renderChildren(item._id, 1, slot, new Set([item._id]))}
          </View>
        );
      })}
    </View>
  );
}

export default React.memo(function LoadoutSection({ equippedItems, equipmentItems }: LoadoutSectionProps) {
  const { t, language } = useLanguage();
  const hasItems = Object.keys(equippedItems).length > 0;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const childrenByParent = useMemo(() => {
    const map: Record<string, EquipmentItem[]> = {};
    for (const item of equipmentItems) {
      if (!item.parentId) continue;
      if (!map[item.parentId]) map[item.parentId] = [];
      map[item.parentId].push(item);
    }
    return map;
  }, [equipmentItems]);

  const itemTpls = useMemo(() => {
    const set = new Set<string>();
    equipmentItems.forEach((item) => set.add(item._tpl));
    return Array.from(set);
  }, [equipmentItems]);

  const itemMetaQuery = useQuery({
    queryKey: ['item-meta', language, itemTpls.join(',')],
    queryFn: () => fetchItemMetaByTpls(itemTpls, language),
    enabled: itemTpls.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  const itemMetaMap = itemMetaQuery.data ?? {};

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

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
          <SlotGroup
            slots={WEAPON_SLOTS}
            equippedItems={equippedItems}
            itemMetaMap={itemMetaMap}
            t={t}
            childrenByParent={childrenByParent}
            expandedIds={expandedIds}
            onToggle={handleToggle}
          />
          <SlotGroup
            slots={GEAR_SLOTS}
            equippedItems={equippedItems}
            itemMetaMap={itemMetaMap}
            t={t}
            childrenByParent={childrenByParent}
            expandedIds={expandedIds}
            onToggle={handleToggle}
          />
          <SlotGroup
            slots={HEAD_SLOTS}
            equippedItems={equippedItems}
            itemMetaMap={itemMetaMap}
            t={t}
            childrenByParent={childrenByParent}
            expandedIds={expandedIds}
            onToggle={handleToggle}
          />
          {equippedItems['ArmBand'] && (
            <View style={styles.groupCard}>
              <EquipmentRow
                slot="ArmBand"
                item={equippedItems['ArmBand']}
                itemMeta={itemMetaMap[equippedItems['ArmBand']._tpl]}
                t={t}
                level={0}
                hasChildren={false}
                expanded={false}
                onToggle={() => undefined}
                isLast
              />
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
    borderRadius: 6,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    borderRadius: 4,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
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
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sizeText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
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
  expandIcon: {
    fontSize: 16,
    color: Colors.textSecondary,
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
