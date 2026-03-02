import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, type LayoutChangeEvent } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';
import { AlertTriangle, Store } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { fetchItemDetail, fetchTraders } from '@/services/tarkovApi';
import { ItemPriceEntry } from '@/types/tarkov';
import { formatPrice } from '@/utils/helpers';
import FullScreenImageModal from '@/components/FullScreenImageModal';

function renderPercent(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return `${value.toFixed(1)}%`;
}

function renderPlain(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return String(value);
}

function priceEntryLabel(item: ItemPriceEntry | undefined, fallback: string): string {
  if (!item) return fallback;
  return item.vendor?.name || item.source || fallback;
}

const TRADER_NAME_TRANSLATIONS: Record<string, { zh: string; ru: string }> = {
  fence: { zh: '黑商', ru: 'Fence' },
  prapor: { zh: '俄商', ru: 'Prapor' },
  therapist: { zh: '大妈', ru: 'Therapist' },
  skier: { zh: '小蓝帽', ru: 'Skier' },
  peacekeeper: { zh: '美商', ru: 'Peacekeeper' },
  mechanic: { zh: '机械师', ru: 'Mechanic' },
  ragman: { zh: '服装商', ru: 'Ragman' },
  jaeger: { zh: '杰哥', ru: 'Jaeger' },
  lightkeeper: { zh: '灯塔商人', ru: 'Lightkeeper' },
  ref: { zh: 'Ref', ru: 'Ref' },
};

function localizeTraderName(name: string, normalizedName: string | null | undefined, language: 'en' | 'zh' | 'ru'): string {
  if (!name || language === 'en') return name;
  const normalized = (normalizedName || name).trim().toLowerCase();
  const mapped = TRADER_NAME_TRANSLATIONS[normalized];
  return mapped?.[language] || name;
}

const HISTORY_CHART_HEIGHT = 176;
const HISTORY_CHART_TOP = 10;
const HISTORY_CHART_RIGHT = 8;
const HISTORY_AXIS_LEFT = 56;
const HISTORY_AXIS_BOTTOM = 34;

function parseHistoryTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return null;
      return parsed > 1e12 ? parsed : parsed * 1000;
    }
    const parsedDate = Date.parse(trimmed);
    if (!Number.isNaN(parsedDate)) return parsedDate;
  }
  return null;
}

function formatTimeTickParts(ms: number): { dateLabel: string; timeLabel: string } {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return {
    dateLabel: `${month}-${day}`,
    timeLabel: `${hour}:${minute}`,
  };
}

function formatPriceTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  }
  return `${Math.round(value)}`;
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const itemId = Array.isArray(id) ? id[0] : id;
  const { t, language } = useLanguage();
  const router = useRouter();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [historyChartWidth, setHistoryChartWidth] = useState(0);

  const itemQuery = useQuery({
    queryKey: ['item-detail', itemId, language],
    queryFn: () => fetchItemDetail(itemId!, language),
    enabled: !!itemId,
    staleTime: 60 * 1000,
  });
  const tradersQuery = useQuery({
    queryKey: ['traders', language],
    queryFn: () => fetchTraders(language),
    staleTime: 30 * 60 * 1000,
  });

  const data = itemQuery.data ?? null;
  const title = data?.name || t.itemDetailsTitle;
  const detailImageUri = data?.gridImageLink || data?.baseImageLink || data?.iconLink || null;

  const traderMap = useMemo(() => {
    const map = new Map<string, { id: string; normalizedName: string; name: string; imageLink?: string }>();
    for (const trader of tradersQuery.data ?? []) {
      if (trader.id) {
        map.set(trader.id.toLowerCase(), {
          id: trader.id,
          normalizedName: trader.normalizedName || trader.name.toLowerCase(),
          name: trader.name,
          imageLink: trader.imageLink,
        });
      }
      if (trader.normalizedName) {
        map.set(trader.normalizedName.toLowerCase(), {
          id: trader.id,
          normalizedName: trader.normalizedName,
          name: trader.name,
          imageLink: trader.imageLink,
        });
      }
      if (trader.name) {
        map.set(trader.name.toLowerCase(), {
          id: trader.id,
          normalizedName: trader.normalizedName || trader.name.toLowerCase(),
          name: trader.name,
          imageLink: trader.imageLink,
        });
      }
    }
    return map;
  }, [tradersQuery.data]);

  const resolveVendorMeta = useCallback((entry: ItemPriceEntry, fallbackLabel: string) => {
    const sourceKey = (entry.source || '').toLowerCase();
    const vendorKey = (entry.vendor?.normalizedName || entry.vendor?.name || '').toLowerCase();
    const key = vendorKey || sourceKey;
    const isFlea = key === 'flea-market' || key === 'fleamarket' || sourceKey === 'fleamarket';
    const trader = key ? traderMap.get(key) : undefined;
    const displayNameRaw = trader?.name || entry.vendor?.name || priceEntryLabel(entry, fallbackLabel);
    const displayName = localizeTraderName(displayNameRaw, trader?.normalizedName || entry.vendor?.normalizedName, language);
    return {
      isFlea,
      canOpen: !isFlea && !!trader,
      traderId: trader?.id || trader?.normalizedName || '',
      imageLink: trader?.imageLink,
      label: displayName,
    };
  }, [language, traderMap]);

  const fleaRows = useMemo(() => [
    { label: t.itemPriceBase, value: formatPrice(data?.basePrice) },
    { label: t.itemPriceFlea, value: formatPrice(data?.low24hPrice ?? data?.lastLowPrice) },
    { label: t.itemPriceAvg24h, value: formatPrice(data?.avg24hPrice) },
    { label: t.itemPriceLastLow, value: formatPrice(data?.lastLowPrice) },
    { label: t.itemPriceChange48h, value: renderPercent(data?.changeLast48hPercent) },
  ], [data, t.itemPriceAvg24h, t.itemPriceBase, t.itemPriceChange48h, t.itemPriceFlea, t.itemPriceLastLow]);

  const attributeRows = useMemo(() => {
    if (!data) return [];
    return [
      { label: t.itemAttrWeight, value: renderPlain(data.weight) },
      { label: t.itemAttrSize, value: data.width && data.height ? `${data.width}x${data.height}` : '-' },
      { label: t.itemAttrErgo, value: renderPlain(data.ergonomicsModifier) },
      { label: t.itemAttrRecoil, value: renderPlain(data.recoilModifier) },
      { label: t.itemAttrAccuracy, value: renderPlain(data.accuracyModifier) },
      { label: t.itemAttrLoudness, value: renderPlain(data.loudness) },
      { label: t.itemAttrVelocity, value: renderPlain(data.velocity) },
      { label: t.itemAttrBlocksHeadphones, value: data.blocksHeadphones === undefined || data.blocksHeadphones === null ? '-' : (data.blocksHeadphones ? t.yes : t.no) },
      { label: t.itemAttrFleaFee, value: formatPrice(data.fleaMarketFee) },
      { label: t.itemAttrMinFleaLevel, value: renderPlain(data.minLevelForFlea) },
      { label: t.itemAttrOfferCount, value: renderPlain(data.lastOfferCount) },
    ].filter((entry) => entry.value !== '-');
  }, [
    data,
    t.itemAttrAccuracy,
    t.itemAttrBlocksHeadphones,
    t.itemAttrErgo,
    t.itemAttrFleaFee,
    t.itemAttrLoudness,
    t.itemAttrMinFleaLevel,
    t.itemAttrOfferCount,
    t.itemAttrRecoil,
    t.itemAttrSize,
    t.itemAttrVelocity,
    t.itemAttrWeight,
    t.no,
    t.yes,
  ]);

  const historyChartPoints = useMemo(() => {
    if (!data?.historicalPrices?.length) return [];
    return [...data.historicalPrices]
      .map((entry) => ({
        ts: parseHistoryTimestamp(entry.timestamp),
        price: entry.price,
      }))
      .filter((entry) => entry.ts !== null && typeof entry.price === 'number' && Number.isFinite(entry.price))
      .map((entry) => ({
        timestamp: entry.ts as number,
        price: entry.price as number,
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-40);
  }, [data?.historicalPrices]);

  const historyRange = useMemo(() => {
    if (historyChartPoints.length === 0) {
      return null;
    }
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const point of historyChartPoints) {
      if (point.price < min) min = point.price;
      if (point.price > max) max = point.price;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return null;
    }
    return { min, max };
  }, [historyChartPoints]);

  const historyChartGeometry = useMemo(() => {
    if (!historyRange || historyChartPoints.length < 2 || historyChartWidth <= 0) {
      return null;
    }

    const plotX = HISTORY_AXIS_LEFT;
    const plotY = HISTORY_CHART_TOP;
    const plotWidth = Math.max(1, historyChartWidth - HISTORY_AXIS_LEFT - HISTORY_CHART_RIGHT);
    const plotHeight = Math.max(1, HISTORY_CHART_HEIGHT - HISTORY_CHART_TOP - HISTORY_AXIS_BOTTOM);
    const timeStart = historyChartPoints[0].timestamp;
    const timeEnd = historyChartPoints[historyChartPoints.length - 1].timestamp;
    const timeDiff = Math.max(1, timeEnd - timeStart);
    const priceDiff = historyRange.max - historyRange.min;

    const polyline = historyChartPoints.map((point) => {
      const normalizedX = (point.timestamp - timeStart) / timeDiff;
      const normalizedY = priceDiff <= 0 ? 0.5 : (point.price - historyRange.min) / priceDiff;
      const x = plotX + normalizedX * plotWidth;
      const y = plotY + (1 - normalizedY) * plotHeight;
      return `${x},${y}`;
    }).join(' ');

    const xTicks = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      const value = timeStart + timeDiff * ratio;
      const { dateLabel, timeLabel } = formatTimeTickParts(value);
      return {
        x: plotX + plotWidth * ratio,
        dateLabel,
        timeLabel,
      };
    });

    const yTicks = Array.from({ length: 3 }, (_, index) => {
      const ratio = index / 2;
      const value = historyRange.max - (historyRange.max - historyRange.min) * ratio;
      return {
        y: plotY + plotHeight * ratio,
        value,
        label: formatPriceTick(value),
      };
    });

    return {
      polyline,
      plotX,
      plotY,
      plotWidth,
      plotHeight,
      xTicks,
      yTicks,
    };
  }, [historyChartPoints, historyChartWidth, historyRange]);

  const handleImagePreview = useCallback(() => {
    if (!detailImageUri) return;
    setPreviewUri(detailImageUri);
    setPreviewVisible(true);
  }, [detailImageUri]);

  const handleClosePreview = useCallback(() => {
    setPreviewVisible(false);
    setPreviewUri(null);
  }, []);

  const openTrader = useCallback((traderId: string) => {
    if (!traderId) return;
    router.push({ pathname: '/(tabs)/search/trader/[id]', params: { id: traderId } });
  }, [router]);

  const handleHistoryChartLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width > 0 && width !== historyChartWidth) {
      setHistoryChartWidth(width);
    }
  }, [historyChartWidth]);

  if (itemQuery.isLoading && !data) {
    return (
      <View style={styles.centerWrap}>
        <Stack.Screen options={{ title: t.itemDetailsTitle }} />
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.hintText}>{t.searchDownloading}</Text>
      </View>
    );
  }

  if (itemQuery.isError && !data) {
    return (
      <View style={styles.centerWrap}>
        <Stack.Screen options={{ title: t.itemDetailsTitle }} />
        <AlertTriangle size={40} color={Colors.statOrange} />
        <Text style={styles.errorText}>{(itemQuery.error as Error).message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!!data && (
          <>
            <View style={styles.heroCard}>
              <TouchableOpacity
                style={styles.heroImageWrap}
                activeOpacity={detailImageUri ? 0.75 : 1}
                onPress={handleImagePreview}
                disabled={!detailImageUri}
              >
                {data.iconLink ? (
                  <Image source={{ uri: data.iconLink }} style={styles.heroImage} contentFit="contain" />
                ) : (
                  <View style={styles.heroPlaceholder} />
                )}
              </TouchableOpacity>
              <View style={styles.heroInfo}>
                <Text style={styles.heroTitle}>{data.name}</Text>
                <Text style={styles.heroSub}>{data.shortName || data.normalizedName || '-'}</Text>
                <Text style={styles.heroSub}>{data.category?.name || `ID: ${data.id}`}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.itemSectionFlea}</Text>
              {fleaRows.map((row) => (
                <View key={row.label} style={styles.row}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowValue}>{row.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.itemSectionBuy}</Text>
              {(data.buyFor ?? []).length === 0 ? (
                <Text style={styles.emptyText}>{t.itemNoBuyData}</Text>
              ) : (
                (data.buyFor ?? []).slice(0, 8).map((entry, idx) => (
                  <View key={`${entry.vendor?.id || entry.vendor?.name || entry.source || 'buy'}-${idx}`} style={styles.row}>
                    {(() => {
                      const vendorMeta = resolveVendorMeta(entry, t.itemBuyFlea);
                      return (
                    <TouchableOpacity
                      style={styles.rowLabelWrap}
                      activeOpacity={vendorMeta.canOpen ? 0.75 : 1}
                      onPress={() => vendorMeta.canOpen && openTrader(vendorMeta.traderId)}
                      disabled={!vendorMeta.canOpen}
                    >
                      {vendorMeta.imageLink ? (
                        <View style={styles.rowTraderAvatarWrap}>
                          <Image source={{ uri: vendorMeta.imageLink }} style={styles.rowTraderAvatar} contentFit="cover" />
                        </View>
                      ) : (
                        <View style={styles.rowTraderAvatarWrap}>
                          {vendorMeta.isFlea ? (
                            <View style={styles.rowTraderAvatarFlea}>
                              <Store size={12} color={Colors.gold} />
                            </View>
                          ) : (
                            <View style={styles.rowTraderAvatarFallback} />
                          )}
                        </View>
                      )}
                      <Text style={styles.rowLabel}>{vendorMeta.label}</Text>
                    </TouchableOpacity>
                      );
                    })()}
                    <Text style={styles.rowValue}>{formatPrice(entry.priceRUB ?? entry.price)}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.itemSectionTraders}</Text>
              {(data.sellFor ?? []).length === 0 ? (
                <Text style={styles.emptyText}>{t.itemNoTraderData}</Text>
              ) : (
                (data.sellFor ?? []).slice(0, 8).map((entry, idx) => (
                  <View key={`${entry.vendor?.id || entry.vendor?.name || entry.source || 'sell'}-${idx}`} style={styles.row}>
                    {(() => {
                      const vendorMeta = resolveVendorMeta(entry, t.itemSectionTraders);
                      return (
                    <TouchableOpacity
                      style={styles.rowLabelWrap}
                      activeOpacity={vendorMeta.canOpen ? 0.75 : 1}
                      onPress={() => vendorMeta.canOpen && openTrader(vendorMeta.traderId)}
                      disabled={!vendorMeta.canOpen}
                    >
                      {vendorMeta.imageLink ? (
                        <View style={styles.rowTraderAvatarWrap}>
                          <Image source={{ uri: vendorMeta.imageLink }} style={styles.rowTraderAvatar} contentFit="cover" />
                        </View>
                      ) : (
                        <View style={styles.rowTraderAvatarWrap}>
                          {vendorMeta.isFlea ? (
                            <View style={styles.rowTraderAvatarFlea}>
                              <Store size={12} color={Colors.gold} />
                            </View>
                          ) : (
                            <View style={styles.rowTraderAvatarFallback} />
                          )}
                        </View>
                      )}
                      <Text style={styles.rowLabel}>{vendorMeta.label}</Text>
                    </TouchableOpacity>
                      );
                    })()}
                    <Text style={styles.rowValue}>{formatPrice(entry.priceRUB ?? entry.price)}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.itemSectionAttributes}</Text>
              {attributeRows.length === 0 ? (
                <Text style={styles.emptyText}>{t.itemNoAttributes}</Text>
              ) : (
                attributeRows.map((row) => (
                  <View key={row.label} style={styles.row}>
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    <Text style={styles.rowValue}>{row.value}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.itemSectionHistory}</Text>
              {historyChartPoints.length >= 2 ? (
                <View style={styles.historyChartWrap} onLayout={handleHistoryChartLayout}>
                  {historyChartWidth > 0 && historyChartGeometry ? (
                    <Svg width={historyChartWidth} height={HISTORY_CHART_HEIGHT}>
                      {historyChartGeometry.yTicks.map((tick, index) => (
                        <Line
                          key={`y-grid-${index}`}
                          x1={historyChartGeometry.plotX}
                          y1={tick.y}
                          x2={historyChartGeometry.plotX + historyChartGeometry.plotWidth}
                          y2={tick.y}
                          stroke={index === 1 ? Colors.border : 'rgba(255,255,255,0.08)'}
                          strokeWidth={1}
                        />
                      ))}
                      <Polyline
                        points={historyChartGeometry.polyline}
                        fill="none"
                        stroke={Colors.gold}
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {historyChartGeometry.yTicks.map((tick, index) => (
                        <SvgText
                          key={`y-label-${index}`}
                          x={historyChartGeometry.plotX - 6}
                          y={tick.y + 4}
                          fill={Colors.textSecondary}
                          fontSize="10"
                          textAnchor="end"
                        >
                          {tick.label}
                        </SvgText>
                      ))}
                      {historyChartGeometry.xTicks.map((tick, index) => {
                        const anchor = index === 0
                          ? 'start'
                          : index === historyChartGeometry.xTicks.length - 1
                            ? 'end'
                            : 'middle';
                        const dateY = historyChartGeometry.plotY + historyChartGeometry.plotHeight + 12;
                        const timeY = dateY + 10;
                        return (
                          <React.Fragment key={`x-label-${index}`}>
                            <SvgText
                              x={tick.x}
                              y={dateY}
                              fill={Colors.textSecondary}
                              fontSize="9"
                              textAnchor={anchor}
                            >
                              {tick.dateLabel}
                            </SvgText>
                            <SvgText
                              x={tick.x}
                              y={timeY}
                              fill={Colors.textSecondary}
                              fontSize="9"
                              textAnchor={anchor}
                            >
                              {tick.timeLabel}
                            </SvgText>
                          </React.Fragment>
                        );
                      })}
                    </Svg>
                  ) : null}
                </View>
              ) : null}
              {historyChartPoints.length < 2 ? (
                <Text style={styles.emptyText}>{t.itemNoHistory}</Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
      <FullScreenImageModal
        visible={previewVisible}
        uri={previewUri}
        onClose={handleClosePreview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
    gap: 12,
  },
  centerWrap: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  hintText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  heroCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    alignItems: 'center',
  },
  heroImageWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroImage: {
    width: 58,
    height: 58,
  },
  heroPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.surfaceLight,
  },
  heroInfo: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  heroSub: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 20,
  },
  rowLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  rowTraderAvatarWrap: {
    width: 20,
    height: 20,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  rowTraderAvatar: {
    width: '100%',
    height: '100%',
  },
  rowTraderAvatarFallback: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
  },
  rowTraderAvatarFlea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217,191,115,0.16)',
  },
  rowLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  rowValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  historyChartWrap: {
    height: HISTORY_CHART_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
});
