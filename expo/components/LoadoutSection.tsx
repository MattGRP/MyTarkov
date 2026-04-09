import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Shield, Package } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import Colors, { alphaWhite } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import type { Language } from '@/constants/i18n';
import FullScreenImageModal from '@/components/FullScreenImageModal';
import { EquipmentItem, getItemImageURL } from '@/types/tarkov';
import { fetchItemMetaByTpls, fetchItemNamesByTpls } from '@/services/tarkovApi';

interface LoadoutSectionProps {
  equippedItems: Record<string, EquipmentItem>;
  equipmentItems: EquipmentItem[];
  showHeader?: boolean;
  itemDetailPathname?: '/(tabs)/search/item/[id]' | '/(tabs)/(home)/item/[id]';
}

type ItemMeta = {
  name: string;
  width?: number;
  height?: number;
  baseImageLink?: string;
  gridImageLink?: string;
};

const WEAPON_SLOTS = ['FirstPrimaryWeapon', 'SecondPrimaryWeapon', 'Holster', 'Scabbard'];
const GEAR_SLOTS = ['ArmorVest', 'TacticalVest', 'Backpack', 'SecuredContainer'];
const HEAD_SLOTS = ['Headwear', 'Earpiece', 'FaceCover', 'Eyewear'];
const COMPOSED_WEAPON_SLOTS = new Set(['FirstPrimaryWeapon', 'SecondPrimaryWeapon', 'Holster']);

const GRID_CELL_PX = 48;
const GRID_MAX_PX = 168;

// Keyed by slot name; each entry holds translations for all languages.
// Adding a new slot = one entry here, not three.
const DYNAMIC_SLOT_LABELS: Record<string, Record<Language, string>> = {
  mod_pistol_grip:  { en: 'Pistol Grip',      zh: '手枪握把',   ru: 'Пистолетная рукоять' },
  mod_foregrip:     { en: 'Foregrip',          zh: '前握把',    ru: 'Передняя рукоять' },
  mod_magazine:     { en: 'Magazine',          zh: '弹匣',     ru: 'Магазин' },
  mod_reciever:     { en: 'Upper Receiver',    zh: '上机匣',    ru: 'Верхний ресивер' },
  mod_receiver:     { en: 'Upper Receiver',    zh: '上机匣',    ru: 'Верхний ресивер' },
  mod_stock:        { en: 'Stock',             zh: '枪托',     ru: 'Приклад' },
  mod_handguard:    { en: 'Handguard',         zh: '护木',     ru: 'Цевье' },
  mod_barrel:       { en: 'Barrel',            zh: '枪管',     ru: 'Ствол' },
  mod_gas_block:    { en: 'Gas Block',         zh: '导气箍',    ru: 'Газблок' },
  mod_muzzle:       { en: 'Muzzle',            zh: '枪口',     ru: 'Дульное устройство' },
  mod_scope:        { en: 'Optic',             zh: '瞄具',     ru: 'Прицел' },
  mod_mount:        { en: 'Mount',             zh: '导轨',     ru: 'Крепление' },
  mod_charge:       { en: 'Charging Handle',   zh: '拉机柄',    ru: 'Рукоятка взвода' },
  patron_in_weapon: { en: 'Chamber',           zh: '膛内子弹',  ru: 'Патрон в патроннике' },
  mod_launcher:     { en: 'Launcher',          zh: '榴弹发射器', ru: 'Подствольник' },
  mod_bipod:        { en: 'Bipod',             zh: '两脚架',    ru: 'Сошки' },
  mod_tactical:     { en: 'Tactical',          zh: '战术位',    ru: 'Тактический слот' },
  mod_nvg:          { en: 'NVG',               zh: '夜视设备',  ru: 'ПНВ' },
  mod_flashlight:   { en: 'Flashlight',        zh: '战术灯',    ru: 'Фонарь' },
  mod_attachment:   { en: 'Attachment',        zh: '配件',     ru: 'Модуль' },
  soft_armor:       { en: 'Soft Armor',        zh: '软甲',     ru: 'Мягкая броня' },
  helmet:           { en: 'Helmet',            zh: '头盔',     ru: 'Шлем' },
};

// Keyed by token word; each entry holds translations for all languages.
const DYNAMIC_SLOT_TOKENS: Record<string, Record<Language, string>> = {
  pistol:    { en: 'Pistol',      zh: '手枪',   ru: 'Пистолетная' },
  grip:      { en: 'Grip',        zh: '握把',   ru: 'рукоять' },
  foregrip:  { en: 'Foregrip',    zh: '前握把',  ru: 'передняя рукоять' },
  magazine:  { en: 'Magazine',    zh: '弹匣',   ru: 'магазин' },
  reciever:  { en: 'Receiver',    zh: '机匣',   ru: 'ресивер' },
  receiver:  { en: 'Receiver',    zh: '机匣',   ru: 'ресивер' },
  stock:     { en: 'Stock',       zh: '枪托',   ru: 'приклад' },
  handguard: { en: 'Handguard',   zh: '护木',   ru: 'цевье' },
  barrel:    { en: 'Barrel',      zh: '枪管',   ru: 'ствол' },
  gas:       { en: 'Gas',         zh: '导气',   ru: 'газ' },
  block:     { en: 'Block',       zh: '箍',     ru: 'блок' },
  muzzle:    { en: 'Muzzle',      zh: '枪口',   ru: 'дульное' },
  scope:     { en: 'Scope',       zh: '瞄具',   ru: 'прицел' },
  mount:     { en: 'Mount',       zh: '导轨',   ru: 'крепление' },
  charge:    { en: 'Charging',    zh: '拉机柄',  ru: 'взвод' },
  tactical:  { en: 'Tactical',    zh: '战术',   ru: 'тактический' },
  launcher:  { en: 'Launcher',    zh: '榴弹',   ru: 'подствольник' },
  patron:    { en: 'Round',       zh: '子弹',   ru: 'патрон' },
  weapon:    { en: 'Weapon',      zh: '武器',   ru: 'оружие' },
  chamber:   { en: 'Chamber',     zh: '膛',     ru: 'патронник' },
  helmet:    { en: 'Helmet',      zh: '头盔',   ru: 'шлем' },
  soft:      { en: 'Soft',        zh: '软',     ru: 'мягкая' },
  armor:     { en: 'Armor',       zh: '甲',     ru: 'броня' },
};

function toTitleCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function getDynamicSlotLabel(slot: string, language: Language): string {
  const normalized = slot.trim();
  if (!normalized) return '';

  const lower = normalized.toLowerCase();

  // Direct slot key match
  const directEntry = DYNAMIC_SLOT_LABELS[lower];
  if (directEntry) return directEntry[language];

  // Prefix/suffix match for generic slots (e.g. soft_armor_*, helmet_*)
  const genericKeys = Object.keys(DYNAMIC_SLOT_LABELS).filter(
    (key) => key.startsWith('soft_armor') || key.startsWith('helmet'),
  );
  for (const key of genericKeys) {
    if (lower.startsWith(`${key}_`) || lower.includes(`_${key}_`) || lower.endsWith(`_${key}`)) {
      return DYNAMIC_SLOT_LABELS[key][language];
    }
  }

  // Token-based fallback: split by underscores/dashes and translate each word
  const cleaned = lower.replace(/^mod[_-]?/i, '');
  const tokens = cleaned
    .split(/[_-]+/g)
    .filter(Boolean)
    .filter((token) => !/^\d+$/.test(token));

  if (tokens.length === 0) return normalized;

  const translatedTokens = tokens.map((token) => {
    const tokenEntry = DYNAMIC_SLOT_TOKENS[token];
    if (tokenEntry) return tokenEntry[language];
    if (language === 'en') return toTitleCase(token);
    return token;
  });

  return language === 'zh' ? translatedTokens.join('') : translatedTokens.join(' ');
}

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

function getItemImageSource(
  tpl: string,
  meta?: { baseImageLink?: string; gridImageLink?: string },
) {
  if (meta?.gridImageLink) {
    return meta.gridImageLink;
  }
  if (meta?.baseImageLink) {
    return meta.baseImageLink;
  }
  return getItemImageURL(tpl);
}

function appendCacheBust(uri: string, token: string): string {
  if (!uri) return uri;
  const separator = uri.includes('?') ? '&' : '?';
  return `${uri}${separator}__r=${encodeURIComponent(token)}`;
}

function ItemGridImage({
  imageUri,
  fallbackUri,
  refreshComposed,
  grid,
}: {
  imageUri: string;
  fallbackUri?: string;
  refreshComposed?: boolean;
  grid: ReturnType<typeof getGridSize>;
}) {
  const [resolvedUri, setResolvedUri] = useState(imageUri);

  useEffect(() => {
    setResolvedUri(imageUri);
  }, [imageUri]);

  useEffect(() => {
    if (!refreshComposed) return;
    let cancelled = false;
    const timers = [
      setTimeout(() => {
        if (cancelled) return;
        setResolvedUri(appendCacheBust(imageUri, `1-${Date.now()}`));
      }, 900),
      setTimeout(() => {
        if (cancelled) return;
        setResolvedUri(appendCacheBust(imageUri, `2-${Date.now()}`));
      }, 2200),
    ];
    return () => {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [imageUri, refreshComposed]);

  const showGrid = grid.width > 1 || grid.height > 1;
  const vLines = Array.from({ length: grid.width + 1 }, (_, i) => i);
  const hLines = Array.from({ length: grid.height + 1 }, (_, i) => i);

  return (
    <View style={[styles.itemImageWrap, { width: grid.displayWidth, height: grid.displayHeight }]}>
      <Image
        source={{ uri: resolvedUri }}
        style={[styles.itemImage, { width: grid.displayWidth, height: grid.displayHeight }]}
        contentFit="contain"
        contentPosition="center"
        cachePolicy={refreshComposed ? 'none' : 'memory-disk'}
        onError={() => {
          if (fallbackUri && resolvedUri !== fallbackUri) {
            setResolvedUri(fallbackUri);
          }
        }}
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

function getSlotLabel(slot: string, t: ReturnType<typeof useLanguage>['t'], language: Language): string {
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
  if (map[slot]) return map[slot];
  return getDynamicSlotLabel(slot, language);
}

function getComposedGridOverride(slot: string, currentMeta?: ItemMeta) {
  const width = currentMeta?.width ?? 1;
  const height = currentMeta?.height ?? 1;
  if (width > 1 || height > 1) return undefined;
  if (slot === 'Holster') {
    return { width: 3, height: 2 };
  }
  return { width: 5, height: 2 };
}

function buildComposedItemImageUrl(
  rootItem: EquipmentItem,
  childrenByParent: Record<string, EquipmentItem[]>,
): string | undefined {
  const slot = rootItem.slotId ?? '';
  if (!COMPOSED_WEAPON_SLOTS.has(slot)) {
    return undefined;
  }

  const queue: EquipmentItem[] = [rootItem];
  const visited = new Set<string>();
  const itemTree: EquipmentItem[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current._id)) continue;
    visited.add(current._id);
    itemTree.push(current);
    const children = childrenByParent[current._id] ?? [];
    for (const child of children) {
      if (!visited.has(child._id)) {
        queue.push(child);
      }
    }
  }

  if (itemTree.length <= 1) {
    return undefined;
  }

  const payloadItems = itemTree.map((item, index) => {
    const payload: Record<string, unknown> = {
      _id: item._id,
      _tpl: item._tpl,
    };
    if (item.upd) payload.upd = item.upd;
    if (index !== 0) {
      if (item.parentId) payload.parentId = item.parentId;
      if (item.slotId) payload.slotId = item.slotId;
    }
    return payload;
  });

  const params = new URLSearchParams();
  params.set(
    'data',
    JSON.stringify({
      id: rootItem._id,
      items: payloadItems,
    }),
  );
  return `https://imagemagic.tarkov.dev/item/${rootItem._id}.webp?${params.toString()}`;
}

function EquipmentRow({
  slot,
  item,
  isLast,
  itemMeta,
  itemName,
  imageUriOverride,
  gridOverride,
  t,
  language,
  level,
  hasChildren,
  expanded,
  onToggle,
  onPreview,
  onOpenDetail,
}: {
  slot: string;
  item: EquipmentItem;
  isLast: boolean;
  itemMeta?: ItemMeta;
  itemName?: string;
  imageUriOverride?: string;
  gridOverride?: { width?: number; height?: number };
  t: ReturnType<typeof useLanguage>['t'];
  language: Language;
  level: number;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
  onPreview?: (uri: string) => void;
  onOpenDetail?: (tpl: string) => void;
}) {
  const dur = item.upd?.Repairable?.Durability;
  const maxDur = item.upd?.Repairable?.MaxDurability;
  const hasDurability = dur !== undefined && maxDur !== undefined && maxDur > 0;
  const durRatio = hasDurability ? (dur! / maxDur!) : 0;
  const durColor = durRatio > 0.6 ? Colors.statGreen : durRatio > 0.3 ? Colors.statOrange : Colors.statRed;
  const grid = getGridSize(gridOverride ?? itemMeta);
  const sizeLabel = grid.width && grid.height ? `${grid.width}x${grid.height}` : undefined;
  const imageUri = imageUriOverride ?? getItemImageSource(item._tpl, itemMeta);
  const fallbackImageUri = getItemImageSource(item._tpl, itemMeta);
  const isComposedImage = Boolean(imageUriOverride);
  const rowPaddingLeft = 12 + level * 14;
  const dividerLeft = rowPaddingLeft + grid.displayWidth + 12;

  return (
    <View>
      <TouchableOpacity
        style={[styles.equipRow, level > 0 && { paddingLeft: rowPaddingLeft }]}
        activeOpacity={0.8}
        onPress={() => onOpenDetail?.(item._tpl)}
        onLongPress={hasChildren ? onToggle : undefined}
        delayLongPress={220}
      >
        <TouchableOpacity
          onPress={() => onPreview && onPreview(imageUri)}
          activeOpacity={0.8}
          disabled={!onPreview}
        >
          <ItemGridImage
            imageUri={imageUri}
            fallbackUri={fallbackImageUri}
            refreshComposed={isComposedImage}
            grid={grid}
          />
        </TouchableOpacity>
        <View style={styles.equipInfo}>
          <View style={styles.slotRow}>
            <Text style={styles.slotName}>{getSlotLabel(slot, t, language)}</Text>
            {sizeLabel && <Text style={styles.sizeText}>{sizeLabel}</Text>}
          </View>
          <Text style={styles.itemId} numberOfLines={1}>
            {itemMeta?.name || itemName || `${t.searchUnknown} (${item._tpl.slice(-6)})`}
          </Text>
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
          <TouchableOpacity
            style={styles.expandToggle}
            onPress={onToggle}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.expandIcon}>{expanded ? 'v' : '>'}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      {!isLast && <View style={[styles.divider, { marginLeft: dividerLeft }]} />}
    </View>
  );
}

function EmptySlotRow({
  slot,
  isLast,
  t,
  language,
}: {
  slot: string;
  isLast: boolean;
  t: ReturnType<typeof useLanguage>['t'];
  language: Language;
}) {
  return (
    <View>
      <View style={styles.equipRow}>
        <View style={[styles.itemImageWrap, styles.emptyImage]} />
        <View style={styles.equipInfo}>
          <Text style={styles.slotName}>{getSlotLabel(slot, t, language)}</Text>
          <Text style={styles.emptySlotText}>{t.none}</Text>
        </View>
      </View>
      {!isLast && <View style={styles.divider} />}
    </View>
  );
}

function shouldShowChild(slot: string, child: EquipmentItem): boolean {
  const childSlot = (child.slotId ?? '').toLowerCase();
  if (slot === 'ArmorVest' || slot === 'TacticalVest') {
    if (childSlot.startsWith('soft_armor')) return false;
  }
  if (slot === 'Headwear') {
    if (childSlot.startsWith('helmet_')) return false;
  }
  return true;
}

function SlotGroup({
  slots,
  equippedItems,
  itemMetaMap,
  itemNameMap,
  itemImageMap,
  itemGridOverrideMap,
  t,
  language,
  childrenByParent,
  expandedIds,
  onToggle,
  onPreview,
  onOpenDetail,
}: {
  slots: string[];
  equippedItems: Record<string, EquipmentItem>;
  itemMetaMap: Record<string, ItemMeta>;
  itemNameMap: Record<string, string>;
  itemImageMap: Record<string, string>;
  itemGridOverrideMap: Record<string, { width?: number; height?: number }>;
  t: ReturnType<typeof useLanguage>['t'];
  language: Language;
  childrenByParent: Record<string, EquipmentItem[]>;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onPreview?: (uri: string) => void;
  onOpenDetail?: (tpl: string) => void;
}) {
  const getVisibleChildren = (parentId: string, slot: string) => {
    const children = childrenByParent[parentId] ?? [];
    return children.filter((child) => shouldShowChild(slot, child));
  };

  const renderChildren = (parentId: string, level: number, slot: string, visited: Set<string>): React.ReactNode => {
    const children = getVisibleChildren(parentId, slot);
    if (children.length === 0) return null;
    if (!expandedIds.has(parentId)) return null;
    return children.map((child, idx) => {
      if (visited.has(child._id)) return null;
      const childVisited = new Set(visited);
      childVisited.add(child._id);
      const hasChildren = (childrenByParent[child._id] ?? []).length > 0;
      const childSlot = child.slotId || 'mod_attachment';
      return (
        <View key={child._id}>
          <EquipmentRow
            slot={childSlot}
            item={child}
            itemMeta={itemMetaMap[child._tpl]}
            itemName={itemNameMap[child._tpl]}
            imageUriOverride={itemImageMap[child._id]}
            gridOverride={itemGridOverrideMap[child._id]}
            t={t}
            language={language}
            level={level}
            hasChildren={hasChildren}
            expanded={expandedIds.has(child._id)}
            onToggle={() => onToggle(child._id)}
            onPreview={onPreview}
            onOpenDetail={onOpenDetail}
            isLast={idx === children.length - 1 && !hasChildren}
          />
          {renderChildren(child._id, level + 1, childSlot, childVisited)}
        </View>
      );
    });
  };

  return (
    <View style={styles.groupCard}>
      {slots.map((slot, idx) => {
      const item = equippedItems[slot];
      if (!item) {
        return (
          <EmptySlotRow
              key={slot}
              slot={slot}
              isLast={idx === slots.length - 1}
              t={t}
              language={language}
            />
          );
        }
      const hasChildren = getVisibleChildren(item._id, slot).length > 0;
      return (
          <View key={slot}>
            <EquipmentRow
              slot={slot}
              item={item}
              itemMeta={itemMetaMap[item._tpl]}
              itemName={itemNameMap[item._tpl]}
              imageUriOverride={itemImageMap[item._id]}
              gridOverride={itemGridOverrideMap[item._id]}
              t={t}
              language={language}
              level={0}
              hasChildren={hasChildren}
              expanded={expandedIds.has(item._id)}
              onToggle={() => onToggle(item._id)}
              onPreview={onPreview}
              onOpenDetail={onOpenDetail}
              isLast={idx === slots.length - 1 && !hasChildren}
            />
            {renderChildren(item._id, 1, slot, new Set([item._id]))}
          </View>
        );
      })}
    </View>
  );
}

export default React.memo(function LoadoutSection({
  equippedItems,
  equipmentItems,
  showHeader = true,
  itemDetailPathname = '/(tabs)/search/item/[id]',
}: LoadoutSectionProps) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const hasItems = Object.keys(equippedItems).length > 0;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

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

  const itemMetaMap = useMemo(() => itemMetaQuery.data ?? {}, [itemMetaQuery.data]);
  const missingNameTpls = useMemo(
    () => itemTpls.filter((tpl) => !itemMetaMap[tpl]?.name),
    [itemMetaMap, itemTpls],
  );
  const itemNameFallbackQuery = useQuery({
    queryKey: ['item-name-fallback', language, missingNameTpls.join(',')],
    queryFn: () => fetchItemNamesByTpls(missingNameTpls, language),
    enabled: missingNameTpls.length > 0,
    staleTime: 30 * 60 * 1000,
  });
  const itemNameFallbackMap = useMemo(
    () => itemNameFallbackQuery.data ?? {},
    [itemNameFallbackQuery.data],
  );
  const itemNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tpl of itemTpls) {
      const fromMeta = itemMetaMap[tpl]?.name;
      if (fromMeta) {
        map[tpl] = fromMeta;
        continue;
      }
      const fallback = itemNameFallbackMap[tpl];
      if (fallback) {
        map[tpl] = fallback;
      }
    }
    return map;
  }, [itemMetaMap, itemNameFallbackMap, itemTpls]);
  const itemImageMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const slot of WEAPON_SLOTS) {
      const item = equippedItems[slot];
      if (!item) continue;
      const composedImageUrl = buildComposedItemImageUrl(item, childrenByParent);
      if (composedImageUrl) {
        map[item._id] = composedImageUrl;
      }
    }
    return map;
  }, [equippedItems, childrenByParent]);
  const itemGridOverrideMap = useMemo(() => {
    const map: Record<string, { width?: number; height?: number }> = {};
    for (const slot of WEAPON_SLOTS) {
      const item = equippedItems[slot];
      if (!item) continue;
      if (!itemImageMap[item._id]) continue;
      const override = getComposedGridOverride(slot, itemMetaMap[item._tpl]);
      if (override) {
        map[item._id] = override;
      }
    }
    return map;
  }, [equippedItems, itemImageMap, itemMetaMap]);

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

  const handlePreview = useCallback((uri: string) => {
    if (!uri) return;
    setPreviewUri(uri);
    setPreviewVisible(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewVisible(false);
    setPreviewUri(null);
  }, []);

  const handleOpenDetail = useCallback((tpl: string) => {
    const id = String(tpl || '').trim();
    if (!id) return;
    const pathname =
      itemDetailPathname === '/(tabs)/(home)/item/[id]'
        ? '/(tabs)/(home)/item/[id]'
        : '/(tabs)/search/item/[id]';
    router.push({ pathname, params: { id } });
  }, [itemDetailPathname, router]);

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.sectionHeader}>
          <Package size={18} color={Colors.gold} />
          <Text style={styles.sectionTitle}>{t.loadout}</Text>
        </View>
      )}

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
            itemNameMap={itemNameMap}
            itemImageMap={itemImageMap}
            itemGridOverrideMap={itemGridOverrideMap}
            t={t}
            language={language}
            childrenByParent={childrenByParent}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            onPreview={handlePreview}
            onOpenDetail={handleOpenDetail}
          />
          <SlotGroup
            slots={GEAR_SLOTS}
            equippedItems={equippedItems}
            itemMetaMap={itemMetaMap}
            itemNameMap={itemNameMap}
            itemImageMap={itemImageMap}
            itemGridOverrideMap={itemGridOverrideMap}
            t={t}
            language={language}
            childrenByParent={childrenByParent}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            onPreview={handlePreview}
            onOpenDetail={handleOpenDetail}
          />
          <SlotGroup
            slots={HEAD_SLOTS}
            equippedItems={equippedItems}
            itemMetaMap={itemMetaMap}
            itemNameMap={itemNameMap}
            itemImageMap={itemImageMap}
            itemGridOverrideMap={itemGridOverrideMap}
            t={t}
            language={language}
            childrenByParent={childrenByParent}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            onPreview={handlePreview}
            onOpenDetail={handleOpenDetail}
          />
          <View style={styles.groupCard}>
            {equippedItems['ArmBand'] ? (
              <EquipmentRow
                slot="ArmBand"
                item={equippedItems['ArmBand']}
                itemMeta={itemMetaMap[equippedItems['ArmBand']._tpl]}
                itemName={itemNameMap[equippedItems['ArmBand']._tpl]}
                imageUriOverride={itemImageMap[equippedItems['ArmBand']._id]}
                gridOverride={itemGridOverrideMap[equippedItems['ArmBand']._id]}
                t={t}
                language={language}
                level={0}
                hasChildren={false}
                expanded={false}
                onToggle={() => undefined}
                onPreview={handlePreview}
                onOpenDetail={handleOpenDetail}
                isLast
              />
            ) : (
              <EmptySlotRow slot="ArmBand" isLast t={t} language={language} />
            )}
          </View>
        </View>
      )}
      <FullScreenImageModal visible={previewVisible} uri={previewUri} onClose={closePreview} />
    </View>
  );
});

const DIVIDER_HEIGHT = StyleSheet.hairlineWidth;

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
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyImage: {
    width: GRID_CELL_PX,
    height: GRID_CELL_PX,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
  },
  itemImage: {
    borderRadius: 0,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: alphaWhite(0.18),
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: alphaWhite(0.18),
  },
  equipInfo: {
    flex: 1,
    gap: 2,
  },
  slotName: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.2,
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
  emptySlotText: {
    fontSize: 13,
    color: Colors.textTertiary,
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
    height: DIVIDER_HEIGHT,
    backgroundColor: Colors.border,
    marginLeft: 72,
  },
  expandIcon: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  expandToggle: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
