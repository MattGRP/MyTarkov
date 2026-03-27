import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExternalLink, ListFilter, Maximize2, Minimize2, Plus, Minus } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnUI, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { WebView } from 'react-native-webview';
import Colors, { alphaBlack, alphaWhite, getModeAccentTheme } from '@/constants/colors';
import { localizeBossName } from '@/constants/i18n';
import { getDockReservedInset } from '@/constants/layout';
import { useLanguage } from '@/providers/LanguageProvider';
import { useGameMode } from '@/providers/GameModeProvider';
import { fetchMapById, fetchTasks } from '@/services/tarkovApi';
import type {
  TaskDetail,
  TarkovMapInteractiveConfig,
  TarkovMapPosition,
  TarkovMapSummary,
} from '@/types/tarkov';
import FullscreenSkeleton from '@/components/FullscreenSkeleton';

type LegendKey = 'extracts' | 'transits' | 'spawns' | 'bosses' | 'lootContainers' | 'switches' | 'hazards';

type MarkerEntry = {
  id: string;
  key: LegendKey;
  title: string;
  u: number;
  v: number;
  y: number | null;
  x: number | null;
  z: number | null;
};

type LayerOption = {
  id: string;
  label: string;
  minY?: number;
  maxY?: number;
};

type MapRect = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
};

const LEGEND_KEYS: LegendKey[] = ['extracts', 'transits', 'spawns', 'bosses', 'lootContainers', 'switches', 'hazards'];
const DEFAULT_LEGEND_VISIBILITY: Record<LegendKey, boolean> = {
  extracts: false,
  transits: false,
  spawns: false,
  bosses: false,
  lootContainers: false,
  switches: false,
  hazards: false,
};
const MAX_RENDER_MARKERS = 420;

const MARKER_COLORS: Record<LegendKey, string> = {
  extracts: '#33D6C6',
  transits: '#EF5D4A',
  spawns: '#67A7FF',
  bosses: '#FF9A37',
  lootContainers: '#D6C24F',
  switches: '#C084FC',
  hazards: '#F43F5E',
};

const MIN_MAP_SCALE = 0.02;
const MAX_MAP_SCALE = 12;

const MAP_LAYER_OPTIONS_BY_KEY: Record<string, LayerOption[]> = {
  reserve: [
    { id: '2nd', label: 'B1', minY: -10000, maxY: -3 },
    { id: 'main', label: 'MAIN', minY: -3, maxY: 10000 },
  ],
  'the-lab': [
    { id: '1st', label: 'L1', minY: -0.9, maxY: 3 },
    { id: '2nd', label: 'L2', minY: 3, maxY: 10000 },
  ],
  factory: [
    { id: 'main', label: 'L1', minY: -1, maxY: 3 },
    { id: '2nd', label: 'L2', minY: 3, maxY: 6 },
    { id: '3rd', label: 'L3', minY: 6, maxY: 10000 },
  ],
  customs: [
    { id: 'underground', label: 'UG', minY: -10000, maxY: 0.5 },
    { id: 'main', label: 'MAIN', minY: 0.5, maxY: 10000 },
  ],
  'ground-zero': [
    { id: 'main', label: 'MAIN', minY: -1000, maxY: 28 },
    { id: 'main_summer', label: 'SUMMER', minY: -1000, maxY: 28 },
  ],
};

const MAP_LAYER_ALIAS: Record<string, string> = {
  'night-factory': 'factory',
  'ground-zero-21': 'ground-zero',
  'ground-zero-tutorial': 'ground-zero',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeSearchToken(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\u0400-\u04ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatCoordinate(value: number | null | undefined): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return numeric.toFixed(1);
}

function normalizeParam(value?: string | string[]): string {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

function parseArrayParam(value?: string | string[]): string[] {
  const raw = normalizeParam(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeLayerMapKey(value?: string | null): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return MAP_LAYER_ALIAS[normalized] ?? normalized;
}

function uniqueUrls(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  values.forEach((value) => {
    const uri = String(value || '').trim();
    if (!uri || seen.has(uri)) return;
    seen.add(uri);
    urls.push(uri);
  });
  return urls;
}

function toLayerTileTemplate(path?: string | null, layerId?: string | null): string | null {
  const value = String(path || '').trim();
  if (!value) return null;
  const layer = String(layerId || '').trim();
  if (!layer) return value;
  return value.replace(/\/([^/{}]+)\/\{z\}\/\{x\}\/\{y\}\.png/i, `/${layer}/{z}/{x}/{y}.png`);
}

function isTileTemplateUri(uri: string | null): boolean {
  if (!uri) return false;
  return /\{z\}/i.test(uri) && /\{x\}/i.test(uri) && /\{y\}/i.test(uri);
}

function isStatic2dMapUri(uri: string | null): boolean {
  if (!uri) return false;
  const lower = uri.toLowerCase();
  if (/(^|\/)maps\/[^/]*-2d\.jpg(?:\?|$)/i.test(lower)) return true;
  return lower.includes('tarkov.dev/maps/') && lower.endsWith('.jpg');
}

function isTilePreviewUri(uri: string | null): boolean {
  if (!uri) return false;
  if (isTileTemplateUri(uri)) return false;
  return /\/\d+\/\d+\/\d+\.png(?:\?|$)/i.test(uri);
}

function buildTileUrl(uriTemplate: string, z: number, x: number, y: number): string {
  return uriTemplate
    .replace(/\{z\}/g, String(z))
    .replace(/\{x\}/g, String(x))
    .replace(/\{y\}/g, String(y));
}

type NativeTile = {
  id: string;
  uri: string;
  x: number;
  y: number;
};

function buildNativeTileGrid(uriTemplate: string, zoom: number): NativeTile[] {
  const count = Math.max(1, Math.floor(Math.pow(2, zoom)));
  const tiles: NativeTile[] = [];
  for (let y = 0; y < count; y += 1) {
    for (let x = 0; x < count; x += 1) {
      tiles.push({
        id: `${zoom}-${x}-${y}`,
        uri: buildTileUrl(uriTemplate, zoom, x, y),
        x,
        y,
      });
    }
  }
  return tiles;
}

function normalizeBounds(bounds?: number[][] | null): [[number, number], [number, number]] | null {
  if (!Array.isArray(bounds) || bounds.length < 2) return null;
  const first = bounds[0];
  const second = bounds[1];
  if (!Array.isArray(first) || !Array.isArray(second)) return null;
  const x1 = Number(first[0]);
  const z1 = Number(first[1]);
  const x2 = Number(second[0]);
  const z2 = Number(second[1]);
  if (![x1, z1, x2, z2].every((value) => Number.isFinite(value))) return null;
  return [[x1, z1], [x2, z2]];
}

function applyRotation(x: number, z: number, rotation: number): { x: number; z: number } {
  if (!rotation) return { x, z };
  const angle = (rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x * cos - z * sin,
    z: x * sin + z * cos,
  };
}

function toMapPlane(position: TarkovMapPosition, config: TarkovMapInteractiveConfig): { x: number; y: number } | null {
  const transform = config.transform ?? [];
  if (transform.length < 4) return null;
  const scaleX = Number(transform[0]);
  const marginX = Number(transform[1]);
  const scaleY = Number(transform[2]);
  const marginY = Number(transform[3]);
  if (![scaleX, marginX, scaleY, marginY].every((value) => Number.isFinite(value))) return null;

  const rotation = Number(config.coordinateRotation ?? 0);
  const rotated = applyRotation(position.x, position.z, Number.isFinite(rotation) ? rotation : 0);
  return {
    x: scaleX * rotated.x + marginX,
    y: -scaleY * rotated.z + marginY,
  };
}

function toRect(config: TarkovMapInteractiveConfig, useSvgBounds: boolean): MapRect | null {
  const bounds = normalizeBounds(useSvgBounds ? config.svgBounds : config.bounds)
    ?? normalizeBounds(config.bounds)
    ?? normalizeBounds(config.svgBounds);
  if (!bounds) return null;

  const first = toMapPlane({ x: bounds[0][0], y: 0, z: bounds[0][1] }, config);
  const second = toMapPlane({ x: bounds[1][0], y: 0, z: bounds[1][1] }, config);
  if (!first || !second) return null;

  const minX = Math.min(first.x, second.x);
  const maxX = Math.max(first.x, second.x);
  const minY = Math.min(first.y, second.y);
  const maxY = Math.max(first.y, second.y);
  const width = maxX - minX;
  const height = maxY - minY;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { minX, maxX, minY, maxY, width, height };
}

function isPositionInWorldBounds(position: TarkovMapPosition, config: TarkovMapInteractiveConfig): boolean {
  const bounds = normalizeBounds(config.bounds);
  if (!bounds) return true;
  const minX = Math.min(bounds[0][0], bounds[1][0]);
  const maxX = Math.max(bounds[0][0], bounds[1][0]);
  const minZ = Math.min(bounds[0][1], bounds[1][1]);
  const maxZ = Math.max(bounds[0][1], bounds[1][1]);
  return position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ;
}

function toNormalizedPoint(
  position: TarkovMapPosition | null | undefined,
  config: TarkovMapInteractiveConfig | null | undefined,
  rect: MapRect | null,
): { u: number; v: number } | null {
  if (!position || !config || !rect) return null;
  if (!isPositionInWorldBounds(position, config)) return null;

  const mapped = toMapPlane(position, config);
  if (!mapped) return null;

  const u = (mapped.x - rect.minX) / rect.width;
  const v = (mapped.y - rect.minY) / rect.height;
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return { u, v };
}

function isSvgUri(uri: string | null): boolean {
  if (!uri) return false;
  return /\.svg(?:$|\?)/i.test(uri);
}

function sampleMarkers(markers: MarkerEntry[], maxCount: number): MarkerEntry[] {
  if (markers.length <= maxCount) return markers;
  const step = markers.length / maxCount;
  const sampled: MarkerEntry[] = [];
  for (let index = 0; index < maxCount; index += 1) {
    const sourceIndex = Math.floor(index * step);
    sampled.push(markers[sourceIndex]);
  }
  return sampled;
}

type WebMapMarker = {
  id: string;
  u: number;
  v: number;
  color: string;
};

type InteractiveMapSource = {
  kind: 'tile' | 'image';
  uri: string;
};

function buildInteractiveMapHtml(
  source: InteractiveMapSource,
  markers: WebMapMarker[],
  options?: { minNativeZoom?: number; maxNativeZoom?: number },
): string {
  const payload = JSON.stringify({
    source,
    markers,
    minNativeZoom: Math.max(0, Math.floor(Number(options?.minNativeZoom ?? 0))),
    maxNativeZoom: Math.max(0, Math.floor(Number(options?.maxNativeZoom ?? 6))),
  }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #0b0d10;
      }
      #viewport {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        touch-action: none;
      }
      #scene {
        position: absolute;
        left: 50%;
        top: 50%;
        transform-origin: center center;
        will-change: transform;
      }
      #tile-layer, #marker-layer {
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        bottom: 0;
      }
      #marker-layer {
        z-index: 3;
        pointer-events: none;
      }
      #map-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        user-select: none;
        -webkit-user-drag: none;
        pointer-events: none;
        z-index: 1;
      }
      .tile {
        position: absolute;
        width: 256px;
        height: 256px;
        user-select: none;
        -webkit-user-drag: none;
        pointer-events: none;
        z-index: 1;
      }
      .marker {
        position: absolute;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        transform: translate(-50%, -50%);
        border: 1px solid rgba(0, 0, 0, 0.55);
        pointer-events: none;
        z-index: 4;
      }
    </style>
  </head>
  <body>
    <div id="viewport">
      <div id="scene">
        <div id="tile-layer">
          <img id="map-image" alt="map" />
        </div>
        <div id="marker-layer"></div>
      </div>
    </div>
    <script>
      (function () {
        const data = ${payload};
        const MIN_SCALE = ${MIN_MAP_SCALE};
        const MAX_SCALE = ${MAX_MAP_SCALE};
        const TILE_SIZE = 256;
        const TILE_VIEW_LIMIT = 180;
        const viewport = document.getElementById('viewport');
        const scene = document.getElementById('scene');
        const tileLayer = document.getElementById('tile-layer');
        const markerLayer = document.getElementById('marker-layer');
        const mapImage = document.getElementById('map-image');
        const source = data.source || { kind: 'image', uri: '' };
        const sourceIsTile = source.kind === 'tile';
        const minNativeZoom = Math.max(0, Number.isFinite(Number(data.minNativeZoom)) ? Math.floor(Number(data.minNativeZoom)) : 0);
        const maxNativeZoom = Math.max(minNativeZoom, Number.isFinite(Number(data.maxNativeZoom)) ? Math.floor(Number(data.maxNativeZoom)) : 6);

        let sceneWidth = 1024;
        let sceneHeight = 1024;
        let translateX = 0;
        let translateY = 0;
        let scale = 1;
        let rotation = 0;
        let tileZoom = sourceIsTile ? Math.max(minNativeZoom, Math.min(maxNativeZoom, 3)) : 0;
        let tileErrors = 0;
        let tileLoads = 0;
        let fallbackSent = false;
        let visualReadySent = false;
        let rafHandle = 0;
        let fitRetryTimer = 0;
        let fitRetryCount = 0;
        let gesture = null;
        const tileNodes = new Map();

        function clamp(value, min, max) {
          return Math.min(Math.max(value, min), max);
        }

        function clampInt(value, min, max) {
          return Math.floor(clamp(value, min, max));
        }

        function postFallback() {
          if (fallbackSent) return;
          fallbackSent = true;
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage('image-error');
          }
        }

        function postError(code) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(code);
          }
        }

        function postVisualReady(code) {
          if (visualReadySent) return;
          visualReadySent = true;
          postError(code);
        }

        function worldSizeForZoom(zoom) {
          return TILE_SIZE * Math.pow(2, zoom);
        }

        function setSceneSize(width, height) {
          sceneWidth = width;
          sceneHeight = height;
          scene.style.width = width + 'px';
          scene.style.height = height + 'px';
        }

        function render() {
          scale = clamp(scale, MIN_SCALE, MAX_SCALE);
          scene.style.transform =
            'translate(-50%, -50%) translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ') rotate(' + rotation + 'deg)';
          if (sourceIsTile) {
            scheduleTileRender();
          }
        }

        function clearTiles() {
          tileNodes.forEach((node) => node.remove());
          tileNodes.clear();
          tileErrors = 0;
          tileLoads = 0;
        }

        function buildTileUrl(template, z, x, y) {
          return String(template || '')
            .replace(/\{z\}/g, String(z))
            .replace(/\{x\}/g, String(x))
            .replace(/\{y\}/g, String(y));
        }

        function renderMarkers() {
          markerLayer.innerHTML = '';
          (Array.isArray(data.markers) ? data.markers : []).forEach((marker) => {
            const u = Number(marker.u);
            const v = Number(marker.v);
            if (!Number.isFinite(u) || !Number.isFinite(v)) return;
            const dot = document.createElement('div');
            dot.className = 'marker';
            dot.style.left = (u * 100) + '%';
            dot.style.top = (v * 100) + '%';
            dot.style.background = marker.color || '#67A7FF';
            markerLayer.appendChild(dot);
          });
        }

        function toScenePoint(screenX, screenY, viewportWidth, viewportHeight) {
          const centerX = viewportWidth / 2 + translateX;
          const centerY = viewportHeight / 2 + translateY;
          const dx = screenX - centerX;
          const dy = screenY - centerY;
          const rad = (-rotation * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const px = (dx * cos - dy * sin) / scale + sceneWidth / 2;
          const py = (dx * sin + dy * cos) / scale + sceneHeight / 2;
          return { x: px, y: py };
        }

        function applyTileZoom(nextZoom) {
          const clampedZoom = clampInt(nextZoom, minNativeZoom, maxNativeZoom);
          if (clampedZoom === tileZoom) return false;
          const delta = clampedZoom - tileZoom;
          tileZoom = clampedZoom;
          if (delta > 0) {
            scale /= Math.pow(2, delta);
          } else if (delta < 0) {
            scale *= Math.pow(2, -delta);
          }
          const worldSize = worldSizeForZoom(tileZoom);
          setSceneSize(worldSize, worldSize);
          clearTiles();
          return true;
        }

        function normalizeTileZoomByScale() {
          if (!sourceIsTile) return false;
          let changed = false;
          while (scale > 2.6 && tileZoom < maxNativeZoom) {
            changed = applyTileZoom(tileZoom + 1) || changed;
          }
          while (scale < 0.32 && tileZoom > minNativeZoom) {
            changed = applyTileZoom(tileZoom - 1) || changed;
          }
          return changed;
        }

        function renderTiles() {
          if (!sourceIsTile) return;
          rafHandle = 0;
          normalizeTileZoomByScale();

          const rect = viewport.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const corners = [
            toScenePoint(0, 0, rect.width, rect.height),
            toScenePoint(rect.width, 0, rect.width, rect.height),
            toScenePoint(0, rect.height, rect.width, rect.height),
            toScenePoint(rect.width, rect.height, rect.width, rect.height),
          ];

          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;
          corners.forEach((point) => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
          });

          minX = clamp(minX, 0, sceneWidth);
          maxX = clamp(maxX, 0, sceneWidth);
          minY = clamp(minY, 0, sceneHeight);
          maxY = clamp(maxY, 0, sceneHeight);

          const maxTileIndex = Math.max(0, Math.pow(2, tileZoom) - 1);
          const startX = clampInt(Math.floor(minX / TILE_SIZE) - 1, 0, maxTileIndex);
          const endX = clampInt(Math.floor(maxX / TILE_SIZE) + 1, 0, maxTileIndex);
          const startY = clampInt(Math.floor(minY / TILE_SIZE) - 1, 0, maxTileIndex);
          const endY = clampInt(Math.floor(maxY / TILE_SIZE) + 1, 0, maxTileIndex);

          const expectedTiles = (endX - startX + 1) * (endY - startY + 1);
          if (expectedTiles > TILE_VIEW_LIMIT && tileZoom > minNativeZoom) {
            if (applyTileZoom(tileZoom - 1)) {
              render();
              return;
            }
          }

          const required = new Set();
          for (let y = startY; y <= endY; y += 1) {
            for (let x = startX; x <= endX; x += 1) {
              const key = tileZoom + '/' + x + '/' + y;
              required.add(key);
              if (tileNodes.has(key)) continue;

              const tile = document.createElement('img');
              tile.className = 'tile';
              tile.alt = '';
              tile.draggable = false;
              tile.style.left = (x * TILE_SIZE) + 'px';
              tile.style.top = (y * TILE_SIZE) + 'px';
              tile.onload = function() {
                tileLoads += 1;
                postVisualReady('tile-loaded');
              };
              tile.onerror = function() {
                tile.style.display = 'none';
                tileErrors += 1;
                if (tileLoads === 0 && tileErrors >= 10) {
                  postFallback();
                }
              };
              tile.src = buildTileUrl(source.uri, tileZoom, x, y);
              tileNodes.set(key, tile);
              tileLayer.appendChild(tile);
            }
          }

          Array.from(tileNodes.entries()).forEach(([key, node]) => {
            if (required.has(key)) return;
            node.remove();
            tileNodes.delete(key);
          });
        }

        function scheduleTileRender() {
          if (!sourceIsTile) return;
          if (rafHandle) return;
          if (window.requestAnimationFrame) {
            rafHandle = window.requestAnimationFrame(renderTiles);
            return;
          }
          rafHandle = window.setTimeout(function() {
            rafHandle = 0;
            renderTiles();
          }, 16);
        }

        function fitToViewport() {
          const rect = viewport.getBoundingClientRect();
          if (!rect.width || !rect.height) {
            if (fitRetryTimer) {
              window.clearTimeout(fitRetryTimer);
              fitRetryTimer = 0;
            }
            if (fitRetryCount < 24) {
              fitRetryCount += 1;
              fitRetryTimer = window.setTimeout(fitToViewport, 40);
            } else {
              postError('viewport-zero');
            }
            return;
          }
          fitRetryCount = 0;
          if (sourceIsTile) {
            const worldSize = worldSizeForZoom(tileZoom);
            setSceneSize(worldSize, worldSize);
            const fitScale = Math.min(rect.width / worldSize, rect.height / worldSize) * 1.08;
            scale = clamp(fitScale, MIN_SCALE, MAX_SCALE);
            translateX = 0;
            translateY = 0;
            rotation = 0;
            renderMarkers();
            render();
            return;
          }

          const fitScale = Math.min(rect.width / sceneWidth, rect.height / sceneHeight);
          scale = clamp(fitScale, MIN_SCALE, MAX_SCALE);
          translateX = 0;
          translateY = 0;
          rotation = 0;
          renderMarkers();
          render();
        }

        function getDistance(t0, t1) {
          const dx = t0.clientX - t1.clientX;
          const dy = t0.clientY - t1.clientY;
          return Math.sqrt(dx * dx + dy * dy);
        }

        function getAngle(t0, t1) {
          return Math.atan2(t0.clientY - t1.clientY, t0.clientX - t1.clientX);
        }

        viewport.addEventListener('touchstart', (event) => {
          if (event.touches.length >= 2) {
            const t0 = event.touches[0];
            const t1 = event.touches[1];
            gesture = {
              type: 'pinch',
              startScale: scale,
              startRotation: rotation,
              startDistance: getDistance(t0, t1),
              startAngle: getAngle(t0, t1),
              startTranslateX: translateX,
              startTranslateY: translateY,
              startCenterX: (t0.clientX + t1.clientX) / 2,
              startCenterY: (t0.clientY + t1.clientY) / 2,
            };
            return;
          }
          if (event.touches.length === 1) {
            const t = event.touches[0];
            gesture = {
              type: 'pan',
              startX: t.clientX,
              startY: t.clientY,
              startTranslateX: translateX,
              startTranslateY: translateY,
            };
          }
        }, { passive: false });

        viewport.addEventListener('touchmove', (event) => {
          if (!gesture) return;
          event.preventDefault();
          if (gesture.type === 'pinch' && event.touches.length >= 2) {
            const t0 = event.touches[0];
            const t1 = event.touches[1];
            const distance = getDistance(t0, t1);
            const angle = getAngle(t0, t1);
            const centerX = (t0.clientX + t1.clientX) / 2;
            const centerY = (t0.clientY + t1.clientY) / 2;

            const distanceRatio = gesture.startDistance > 0 ? (distance / gesture.startDistance) : 1;
            scale = clamp(gesture.startScale * distanceRatio, MIN_SCALE, MAX_SCALE);
            rotation = gesture.startRotation + ((angle - gesture.startAngle) * 180 / Math.PI);
            translateX = gesture.startTranslateX + (centerX - gesture.startCenterX);
            translateY = gesture.startTranslateY + (centerY - gesture.startCenterY);
            render();
            return;
          }
          if (gesture.type === 'pan' && event.touches.length === 1) {
            const t = event.touches[0];
            translateX = gesture.startTranslateX + (t.clientX - gesture.startX);
            translateY = gesture.startTranslateY + (t.clientY - gesture.startY);
            render();
          }
        }, { passive: false });

        viewport.addEventListener('touchend', (event) => {
          if (event.touches.length === 0) {
            gesture = null;
            return;
          }
          if (event.touches.length === 1) {
            const t = event.touches[0];
            gesture = {
              type: 'pan',
              startX: t.clientX,
              startY: t.clientY,
              startTranslateX: translateX,
              startTranslateY: translateY,
            };
          }
        }, { passive: false });

        viewport.addEventListener('wheel', (event) => {
          event.preventDefault();
          const ratio = event.deltaY > 0 ? 0.9 : 1.1;
          scale = clamp(scale * ratio, MIN_SCALE, MAX_SCALE);
          render();
        }, { passive: false });

        window.__mapAdjustZoom = function(delta) {
          const ratio = 1 + Number(delta || 0);
          if (!Number.isFinite(ratio) || ratio <= 0) return;
          scale = clamp(scale * ratio, MIN_SCALE, MAX_SCALE);
          render();
        };

        window.__mapReset = function() {
          fitToViewport();
        };

        window.onerror = function() {
          postError('js-error');
          return false;
        };

        window.addEventListener('resize', fitToViewport);
        postError('ready');

        if (sourceIsTile) {
          mapImage.style.display = 'none';
          const worldSize = worldSizeForZoom(tileZoom);
          setSceneSize(worldSize, worldSize);
          renderMarkers();
          fitToViewport();
          window.setTimeout(fitToViewport, 16);
        } else {
          mapImage.style.display = 'block';
          mapImage.onload = function() {
            const width = mapImage.naturalWidth || 1024;
            const height = mapImage.naturalHeight || 1024;
            setSceneSize(width, height);
            renderMarkers();
            fitToViewport();
            window.setTimeout(fitToViewport, 16);
            postVisualReady('image-loaded');
          };
          mapImage.onerror = function() {
            postFallback();
          };
          mapImage.src = source.uri || '';
          if (!source.uri) {
            postFallback();
          }
        }
      })();
    </script>
  </body>
</html>`;
}

export default function MapDetailScreen() {
  const {
    id,
    name,
    normalizedName,
    wiki,
    description,
    players,
    raidDuration,
    imageLink,
    imageFallbackLinks,
    interactiveImageLink,
    interactiveFallbackLinks,
  } = useLocalSearchParams<{
    id: string | string[];
    name?: string | string[];
    normalizedName?: string | string[];
    wiki?: string | string[];
    description?: string | string[];
    players?: string | string[];
    raidDuration?: string | string[];
    imageLink?: string | string[];
    imageFallbackLinks?: string | string[];
    interactiveImageLink?: string | string[];
    interactiveFallbackLinks?: string | string[];
  }>();

  const mapId = normalizeParam(id);
  const router = useRouter();
  const { t, language } = useLanguage();
  const { gameMode } = useGameMode();
  const insets = useSafeAreaInsets();
  const accentTheme = useMemo(() => getModeAccentTheme(gameMode), [gameMode]);

  const mapQuery = useQuery({
    queryKey: ['map-detail', mapId, language, gameMode],
    queryFn: ({ signal }) => fetchMapById(mapId, language, { signal, gameMode }),
    enabled: !!mapId,
    staleTime: 30 * 60 * 1000,
  });

  const previewMap = useMemo<TarkovMapSummary | null>(() => {
    if (!mapId) return null;
    const previewName = normalizeParam(name) || mapId;
    const previewNormalizedName = normalizeParam(normalizedName) || undefined;
    const previewRaidDuration = Number(raidDuration);
    const previewImageFallbacks = parseArrayParam(imageFallbackLinks);
    const previewInteractiveFallbacks = parseArrayParam(interactiveFallbackLinks);
    return {
      id: mapId,
      name: previewName,
      normalizedName: previewNormalizedName,
      wiki: normalizeParam(wiki) || undefined,
      description: normalizeParam(description) || undefined,
      players: normalizeParam(players) || undefined,
      raidDuration: Number.isFinite(previewRaidDuration) ? previewRaidDuration : null,
      imageLink: normalizeParam(imageLink) || null,
      imageFallbackLinks: previewImageFallbacks,
      interactiveImageLink: normalizeParam(interactiveImageLink) || null,
      interactiveFallbackLinks: previewInteractiveFallbacks,
      mapPageLink: null,
      legendStats: null,
      mapConfig: null,
      extracts: [],
      transits: [],
      spawns: [],
      bosses: [],
      lootContainers: [],
      switches: [],
      hazards: [],
      artilleryZones: [],
    };
  }, [description, imageFallbackLinks, imageLink, interactiveFallbackLinks, interactiveImageLink, mapId, name, normalizedName, players, raidDuration, wiki]);

  const mapData = mapQuery.data ?? previewMap;

  const staticImageUris = useMemo(() => {
    const all = uniqueUrls([
      mapData?.imageLink,
      ...(mapData?.imageFallbackLinks ?? []),
    ]);
    const raster = all.filter((uri) => !isSvgUri(uri));
    const svg = all.filter((uri) => isSvgUri(uri));
    return [...raster, ...svg];
  }, [mapData?.imageFallbackLinks, mapData?.imageLink]);
  const [staticImageIndex, setStaticImageIndex] = useState(0);
  const staticImageUriKey = useMemo(() => staticImageUris.join('|'), [staticImageUris]);

  useEffect(() => {
    setStaticImageIndex(0);
  }, [staticImageUriKey]);

  const staticImageUri = staticImageUris[staticImageIndex] ?? null;
  const staticSvg = isSvgUri(staticImageUri);
  const handleStaticImageError = useCallback(() => {
    setStaticImageIndex((previous) => {
      if (previous >= staticImageUris.length - 1) return previous;
      return previous + 1;
    });
  }, [staticImageUris.length]);

  const interactiveConfig = mapData?.mapConfig ?? null;
  const mapLayerOptions = useMemo(() => {
    const key = normalizeLayerMapKey(mapData?.normalizedName || mapId);
    return MAP_LAYER_OPTIONS_BY_KEY[key] ?? [];
  }, [mapData?.normalizedName, mapId]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  useEffect(() => {
    if (mapLayerOptions.length === 0) {
      setSelectedLayerId(null);
      return;
    }
    const firstId = mapLayerOptions[0].id;
    setSelectedLayerId((previous) => (previous && mapLayerOptions.some((layer) => layer.id === previous) ? previous : firstId));
  }, [mapLayerOptions]);

  const interactiveSources = useMemo<InteractiveMapSource[]>(() => {
    const selectedLayerTileTemplate = toLayerTileTemplate(interactiveConfig?.tilePath, selectedLayerId);
    const defaultTileTemplate = String(interactiveConfig?.tilePath || '').trim() || null;
    const urls = uniqueUrls([
      selectedLayerTileTemplate,
      defaultTileTemplate,
      mapData?.interactiveImageLink,
      ...(mapData?.interactiveFallbackLinks ?? []),
      String(interactiveConfig?.svgPath || '').trim() || null,
    ]).filter((uri) => !isStatic2dMapUri(uri) && !isTilePreviewUri(uri));
    return urls.map((uri) => ({
      kind: isTileTemplateUri(uri) ? 'tile' : 'image',
      uri,
    }));
  }, [interactiveConfig?.svgPath, interactiveConfig?.tilePath, mapData?.interactiveFallbackLinks, mapData?.interactiveImageLink, selectedLayerId]);

  const [interactiveImageIndex, setInteractiveImageIndex] = useState(0);
  const interactiveSourceKey = useMemo(
    () => interactiveSources.map((entry) => `${entry.kind}:${entry.uri}`).join('|'),
    [interactiveSources],
  );
  useEffect(() => {
    setInteractiveImageIndex(0);
  }, [interactiveSourceKey]);

  const interactiveSource = interactiveSources[interactiveImageIndex] ?? null;
  const interactiveUri = interactiveSource?.uri ?? null;
  const handleInteractiveImageError = useCallback(() => {
    setInteractiveImageIndex((previous) => {
      if (previous >= interactiveSources.length - 1) return previous;
      return previous + 1;
    });
  }, [interactiveSources.length]);

  const renderRect = useMemo(() => {
    if (!interactiveConfig) return null;
    return toRect(interactiveConfig, false) ?? toRect(interactiveConfig, true);
  }, [interactiveConfig]);

  const markersByLegend = useMemo<Record<LegendKey, MarkerEntry[]>>(() => {
    const empty: Record<LegendKey, MarkerEntry[]> = {
      extracts: [],
      transits: [],
      spawns: [],
      bosses: [],
      lootContainers: [],
      switches: [],
      hazards: [],
    };
    if (!mapData || !interactiveConfig || !renderRect) return empty;

    const pushMarker = (
      legendKey: LegendKey,
      markerId: string,
      title: string,
      position: TarkovMapPosition | null | undefined,
      markerY?: number | null,
    ) => {
      const normalized = toNormalizedPoint(position, interactiveConfig, renderRect);
      if (!normalized) return;
      empty[legendKey].push({
        id: markerId,
        key: legendKey,
        title,
        u: normalized.u,
        v: normalized.v,
        y: Number.isFinite(Number(markerY)) ? Number(markerY) : (Number.isFinite(Number(position?.y)) ? Number(position?.y) : null),
        x: Number.isFinite(Number(position?.x)) ? Number(position?.x) : null,
        z: Number.isFinite(Number(position?.z)) ? Number(position?.z) : null,
      });
    };

    (mapData.extracts ?? []).forEach((entry, index) => {
      const y = Number.isFinite(Number(entry.position?.y))
        ? Number(entry.position?.y)
        : Number.isFinite(Number(entry.top)) && Number.isFinite(Number(entry.bottom))
          ? (Number(entry.top) + Number(entry.bottom)) / 2
          : null;
      pushMarker('extracts', String(entry.id || `extract-${index}`), String(entry.name || '').trim() || 'Extract', entry.position, y);
    });

    (mapData.transits ?? []).forEach((entry, index) => {
      const y = Number.isFinite(Number(entry.position?.y))
        ? Number(entry.position?.y)
        : Number.isFinite(Number(entry.top)) && Number.isFinite(Number(entry.bottom))
          ? (Number(entry.top) + Number(entry.bottom)) / 2
          : null;
      pushMarker('transits', String(entry.id || `transit-${index}`), String(entry.description || '').trim() || 'Transit', entry.position, y);
    });

    (mapData.spawns ?? []).forEach((entry, index) => {
      const title = String(entry.zoneName || '').trim() || 'Spawn';
      pushMarker('spawns', `spawn-${index}`, title, entry.position, entry.position?.y ?? null);
    });

    (mapData.lootContainers ?? []).forEach((entry, index) => {
      const title = String(entry.lootContainer?.name || '').trim() || 'Loot';
      pushMarker('lootContainers', `loot-${index}`, title, entry.position, entry.position?.y ?? null);
    });

    (mapData.switches ?? []).forEach((entry, index) => {
      pushMarker('switches', String(entry.id || `switch-${index}`), String(entry.name || '').trim() || 'Switch', entry.position, entry.position?.y ?? null);
    });

    (mapData.hazards ?? []).forEach((entry, index) => {
      const y = Number.isFinite(Number(entry.position?.y))
        ? Number(entry.position?.y)
        : Number.isFinite(Number(entry.top)) && Number.isFinite(Number(entry.bottom))
          ? (Number(entry.top) + Number(entry.bottom)) / 2
          : null;
      pushMarker('hazards', `hazard-${index}`, String(entry.name || '').trim() || 'Hazard', entry.position, y);
    });

    (mapData.artilleryZones ?? []).forEach((entry, index) => {
      const y = Number.isFinite(Number(entry.position?.y))
        ? Number(entry.position?.y)
        : Number.isFinite(Number(entry.top)) && Number.isFinite(Number(entry.bottom))
          ? (Number(entry.top) + Number(entry.bottom)) / 2
          : null;
      pushMarker('hazards', `artillery-${index}`, 'Artillery', entry.position, y);
    });

    return empty;
  }, [interactiveConfig, mapData, renderRect]);

  const legendCounts = useMemo(() => ({
    extracts: markersByLegend.extracts.length,
    transits: markersByLegend.transits.length,
    spawns: markersByLegend.spawns.length,
    bosses: markersByLegend.bosses.length,
    lootContainers: markersByLegend.lootContainers.length,
    switches: markersByLegend.switches.length,
    hazards: markersByLegend.hazards.length,
  }), [markersByLegend]);

  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [legendModalVisible, setLegendModalVisible] = useState(false);
  const [legendDetailKey, setLegendDetailKey] = useState<LegendKey | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MarkerEntry | null>(null);
  const [legendVisibility, setLegendVisibility] = useState<Record<LegendKey, boolean>>(DEFAULT_LEGEND_VISIBILITY);

  useEffect(() => {
    setLegendVisibility(DEFAULT_LEGEND_VISIBILITY);
  }, [mapData?.id]);

  useEffect(() => {
    if (!fullscreenVisible) {
      setLegendModalVisible(false);
      setLegendDetailKey(null);
      setSelectedMarker(null);
    }
  }, [fullscreenVisible]);

  useEffect(() => {
    if (!legendModalVisible) {
      setLegendDetailKey(null);
      return;
    }
    setSelectedMarker(null);
  }, [legendModalVisible]);

  const visibleMarkers = useMemo(() => {
    const entries: MarkerEntry[] = [];
    const activeLayer = mapLayerOptions.find((layer) => layer.id === selectedLayerId) ?? null;
    const minY = Number(activeLayer?.minY);
    const maxY = Number(activeLayer?.maxY);
    const hasLayerHeightFilter = Number.isFinite(minY) && Number.isFinite(maxY);
    LEGEND_KEYS.forEach((key) => {
      if (!legendVisibility[key]) return;
      markersByLegend[key].forEach((marker) => {
        const markerY = Number(marker.y);
        if (hasLayerHeightFilter && Number.isFinite(markerY) && (markerY < minY || markerY > maxY)) return;
        entries.push(marker);
      });
    });
    return sampleMarkers(entries, MAX_RENDER_MARKERS);
  }, [legendVisibility, mapLayerOptions, markersByLegend, selectedLayerId]);

  const legendEntries = useMemo(() => ([
    { key: 'extracts' as const, label: t.searchMapLegendExtracts },
    { key: 'transits' as const, label: t.searchMapLegendTransits },
    { key: 'spawns' as const, label: t.searchMapLegendSpawns },
    { key: 'bosses' as const, label: t.searchMapLegendBosses },
    { key: 'lootContainers' as const, label: t.searchMapLegendLoot },
    { key: 'switches' as const, label: t.searchMapLegendSwitches },
    { key: 'hazards' as const, label: t.searchMapLegendHazards },
  ]), [
    t.searchMapLegendBosses,
    t.searchMapLegendExtracts,
    t.searchMapLegendHazards,
    t.searchMapLegendLoot,
    t.searchMapLegendSpawns,
    t.searchMapLegendSwitches,
    t.searchMapLegendTransits,
  ]);
  const legendLabelByKey = useMemo(() => ({
    extracts: t.searchMapLegendExtracts,
    transits: t.searchMapLegendTransits,
    spawns: t.searchMapLegendSpawns,
    bosses: t.searchMapLegendBosses,
    lootContainers: t.searchMapLegendLoot,
    switches: t.searchMapLegendSwitches,
    hazards: t.searchMapLegendHazards,
  }), [
    t.searchMapLegendBosses,
    t.searchMapLegendExtracts,
    t.searchMapLegendHazards,
    t.searchMapLegendLoot,
    t.searchMapLegendSpawns,
    t.searchMapLegendSwitches,
    t.searchMapLegendTransits,
  ]);
  const legendDetailMarkers = useMemo(() => {
    if (!legendDetailKey) return [];
    return markersByLegend[legendDetailKey] ?? [];
  }, [legendDetailKey, markersByLegend]);
  const localizedMapBosses = useMemo(() => (
    (mapData?.bosses ?? [])
      .map((boss) => ({
        id: String(boss.normalizedName || boss.name || '').trim(),
        name: localizeBossName(String(boss.name || boss.normalizedName || ''), boss.normalizedName, language),
        normalizedName: String(boss.normalizedName || '').trim(),
        spawnChance: Number.isFinite(Number(boss.spawnChance)) ? Number(boss.spawnChance) : null,
      }))
      .filter((boss) => boss.id && boss.name)
  ), [language, mapData?.bosses]);
  const handleOpenTaskDetail = useCallback((task: TaskDetail) => {
    const taskId = String(task.id || task.normalizedName || task.name || '').trim();
    if (!taskId) return;
    setLegendModalVisible(false);
    setLegendDetailKey(null);
    setSelectedMarker(null);
    setFullscreenVisible(false);
    router.push({
      pathname: '/(tabs)/search/task/[id]',
      params: {
        id: taskId,
        name: task.name || '',
        normalizedName: task.normalizedName || '',
        mapName: task.map?.name || '',
        taskImageLink: task.taskImageLink || '',
        traderId: task.trader.id || task.trader.normalizedName || task.trader.name || '',
        traderName: task.trader.name || '',
        traderNormalizedName: task.trader.normalizedName || '',
        traderImageLink: task.trader.imageLink || '',
        minPlayerLevel: String(task.minPlayerLevel ?? 0),
        experience: String(task.experience ?? 0),
        kappaRequired: task.kappaRequired ? '1' : '0',
        lightkeeperRequired: task.lightkeeperRequired ? '1' : '0',
      },
    });
  }, [router]);
  const handleOpenBossDetail = useCallback((bossId: string, bossName?: string, bossNormalizedName?: string) => {
    const idValue = String(bossId || bossNormalizedName || bossName || '').trim();
    if (!idValue) return;
    setLegendModalVisible(false);
    setLegendDetailKey(null);
    setSelectedMarker(null);
    setFullscreenVisible(false);
    router.push({
      pathname: '/(tabs)/search/boss/[id]',
      params: {
        id: idValue,
        name: bossName || '',
        normalizedName: bossNormalizedName || '',
      },
    });
  }, [router]);
  const markerTaskQuery = useQuery({
    queryKey: ['map-marker-task-links', mapData?.id, language, gameMode],
    queryFn: ({ signal }) => fetchTasks(language, {
      limit: 320,
      signal,
      gameMode,
      priority: 'background',
    }),
    enabled: fullscreenVisible && !!selectedMarker && !!mapData?.id,
    staleTime: 30 * 60 * 1000,
  });
  const relatedTasks = useMemo(() => {
    if (!selectedMarker) return [];
    const markerToken = normalizeSearchToken(selectedMarker.title);
    if (!markerToken || markerToken.length < 2) return [];
    const mapToken = normalizeSearchToken(mapData?.normalizedName || mapData?.name || '');
    const mapTokenAlt = normalizeSearchToken(mapData?.name || '');
    const tasks = markerTaskQuery.data ?? [];
    return tasks.filter((task) => {
      const taskMapTokens = [
        normalizeSearchToken(task.map?.normalizedName || ''),
        normalizeSearchToken(task.map?.name || ''),
        ...(task.objectives ?? []).flatMap((objective) => (
          (objective.maps ?? []).map((entry) => normalizeSearchToken(entry.normalizedName || entry.name || ''))
        )),
      ].filter(Boolean);
      const hasMapMatch = taskMapTokens.length === 0
        || taskMapTokens.some((token) => token === mapToken || token === mapTokenAlt || mapToken.includes(token) || token.includes(mapToken));
      if (!hasMapMatch) return false;
      const taskNameToken = normalizeSearchToken(task.name);
      if (taskNameToken && (taskNameToken.includes(markerToken) || markerToken.includes(taskNameToken))) return true;
      return (task.objectives ?? []).some((objective) => normalizeSearchToken(objective.description).includes(markerToken));
    }).slice(0, 8);
  }, [mapData?.name, mapData?.normalizedName, markerTaskQuery.data, selectedMarker]);
  const relatedBosses = useMemo(() => {
    if (!selectedMarker) return [];
    const markerToken = normalizeSearchToken(selectedMarker.title);
    if (!markerToken || markerToken.length < 2) return [];
    return localizedMapBosses
      .filter((boss) => {
        const bossToken = normalizeSearchToken(boss.normalizedName || boss.name);
        return bossToken.includes(markerToken) || markerToken.includes(bossToken);
      })
      .slice(0, 4);
  }, [localizedMapBosses, selectedMarker]);

  const localizeLayerLabel = useCallback((label: string) => {
    const key = String(label || '').trim().toUpperCase();
    if (key === 'MAIN') return t.searchMapLayerMain;
    if (key === 'UG') return t.searchMapLayerUnderground;
    if (key === 'SUMMER') return t.searchMapLayerSummer;
    if (key === 'B1') return t.searchMapLayerB1;
    if (key === 'L1') return t.searchMapLayerL1;
    if (key === 'L2') return t.searchMapLayerL2;
    if (key === 'L3') return t.searchMapLayerL3;
    return label;
  }, [
    t.searchMapLayerB1,
    t.searchMapLayerL1,
    t.searchMapLayerL2,
    t.searchMapLayerL3,
    t.searchMapLayerMain,
    t.searchMapLayerSummer,
    t.searchMapLayerUnderground,
  ]);

  const [previewWidth, setPreviewWidth] = useState(0);
  const mapWebViewRef = useRef<WebView>(null);
  const windowDimensions = useWindowDimensions();
  const [nativeViewportWidth, setNativeViewportWidth] = useState(0);
  const [nativeViewportHeight, setNativeViewportHeight] = useState(0);
  const [webViewReady, setWebViewReady] = useState(false);
  const [forceNativeFallback, setForceNativeFallback] = useState(true);
  const nativeTileLoadCountRef = useRef(0);
  const nativeTileErrorCountRef = useRef(0);

  const nativeScale = useSharedValue(1);
  const nativeStartScale = useSharedValue(1);
  const nativeRotation = useSharedValue(0);
  const nativeStartRotation = useSharedValue(0);
  const nativeTranslateX = useSharedValue(0);
  const nativeTranslateY = useSharedValue(0);
  const nativeStartTranslateX = useSharedValue(0);
  const nativeStartTranslateY = useSharedValue(0);

  const previewRect = useMemo(() => {
    if (!interactiveConfig) return null;
    return toRect(interactiveConfig, false) ?? toRect(interactiveConfig, true);
  }, [interactiveConfig]);

  const previewAspectRatio = useMemo(() => {
    if (!previewRect) return 1;
    const ratio = previewRect.width / previewRect.height;
    if (!Number.isFinite(ratio) || ratio <= 0) return 1;
    return clamp(ratio, 0.6, 2.4);
  }, [previewRect]);

  const previewHeight = useMemo(() => {
    const fallbackWidth = Math.max(windowDimensions.width - 56, 220);
    const targetWidth = previewWidth > 0 ? previewWidth : fallbackWidth;
    const targetHeight = targetWidth / previewAspectRatio;
    return Math.round(clamp(targetHeight, 220, windowDimensions.height * 0.72));
  }, [previewAspectRatio, previewWidth, windowDimensions.height, windowDimensions.width]);

  const webMarkers = useMemo<WebMapMarker[]>(() => (
    visibleMarkers.map((marker) => ({
      id: marker.id,
      u: marker.u,
      v: marker.v,
      color: MARKER_COLORS[marker.key],
    }))
  ), [visibleMarkers]);
  const interactiveMapHtml = useMemo(() => {
    if (!interactiveSource) return null;
    const maxNativeZoom = Math.max(0, Math.floor(Number(interactiveConfig?.maxZoom ?? 6)));
    const minNativeZoom = 0;
    return buildInteractiveMapHtml(interactiveSource, webMarkers, {
      minNativeZoom,
      maxNativeZoom,
    });
  }, [interactiveConfig?.maxZoom, interactiveSource, webMarkers]);
  const activeInteractiveSourceKey = useMemo(
    () => `${interactiveSource?.kind || 'none'}:${interactiveSource?.uri || ''}`,
    [interactiveSource?.kind, interactiveSource?.uri],
  );

  const nativeTileTemplate = useMemo(() => {
    if (interactiveSource?.kind !== 'tile') return null;
    return interactiveSource.uri;
  }, [interactiveSource]);
  const defaultNativeTileZoom = useMemo(() => {
    const max = Math.max(0, Math.floor(Number(interactiveConfig?.maxZoom ?? 6)));
    return Math.max(2, Math.min(3, max));
  }, [interactiveConfig?.maxZoom]);
  const [nativeTileZoom, setNativeTileZoom] = useState(defaultNativeTileZoom);
  useEffect(() => {
    setNativeTileZoom(defaultNativeTileZoom);
  }, [activeInteractiveSourceKey, defaultNativeTileZoom]);
  const nativeTiles = useMemo(() => {
    if (!nativeTileTemplate) return [];
    return buildNativeTileGrid(nativeTileTemplate, nativeTileZoom);
  }, [nativeTileTemplate, nativeTileZoom]);
  const nativeTileCount = Math.max(1, Math.floor(Math.pow(2, nativeTileZoom)));
  const nativeCanvasSize = useMemo(() => {
    if (nativeTileTemplate) {
      return nativeTileCount * 256;
    }
    return 1200;
  }, [nativeTileCount, nativeTileTemplate]);
  const nativeImageUri = useMemo(() => {
    if (interactiveSource?.kind === 'image' && interactiveSource.uri) return interactiveSource.uri;
    return null;
  }, [interactiveSource]);
  const nativeRenderRect = useMemo(() => {
    if (!renderRect) return null;
    const zoomFactor = Math.max(1, Math.pow(2, nativeTileZoom));
    return {
      minX: renderRect.minX * zoomFactor,
      maxX: renderRect.maxX * zoomFactor,
      minY: renderRect.minY * zoomFactor,
      maxY: renderRect.maxY * zoomFactor,
      width: renderRect.width * zoomFactor,
      height: renderRect.height * zoomFactor,
    };
  }, [nativeTileZoom, renderRect]);
  const nativeMarkers = useMemo(() => {
    if (!nativeRenderRect) return [];
    return visibleMarkers.map((marker) => ({
      id: marker.id,
      key: marker.key,
      title: marker.title,
      y: marker.y,
      x: marker.x,
      z: marker.z,
      color: MARKER_COLORS[marker.key],
      left: nativeRenderRect.minX + marker.u * nativeRenderRect.width,
      top: nativeRenderRect.minY + marker.v * nativeRenderRect.height,
    }));
  }, [nativeRenderRect, visibleMarkers]);

  const nativeTransformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: nativeTranslateX.value },
      { translateY: nativeTranslateY.value },
      { scale: nativeScale.value },
      { rotateZ: `${nativeRotation.value}rad` },
    ],
  }));

  const nativeGesture = useMemo(() => Gesture.Simultaneous(
    Gesture.Pan()
      .onStart(() => {
        nativeStartTranslateX.value = nativeTranslateX.value;
        nativeStartTranslateY.value = nativeTranslateY.value;
      })
      .onUpdate((event) => {
        nativeTranslateX.value = nativeStartTranslateX.value + event.translationX;
        nativeTranslateY.value = nativeStartTranslateY.value + event.translationY;
      }),
    Gesture.Pinch()
      .onStart(() => {
        nativeStartScale.value = nativeScale.value;
      })
      .onUpdate((event) => {
        const next = nativeStartScale.value * event.scale;
        nativeScale.value = next < MIN_MAP_SCALE ? MIN_MAP_SCALE : next > MAX_MAP_SCALE ? MAX_MAP_SCALE : next;
      }),
    Gesture.Rotation()
      .onStart(() => {
        nativeStartRotation.value = nativeRotation.value;
      })
      .onUpdate((event) => {
        nativeRotation.value = nativeStartRotation.value + event.rotation;
      }),
  ), [
    nativeRotation,
    nativeScale,
    nativeStartRotation,
    nativeStartScale,
    nativeStartTranslateX,
    nativeStartTranslateY,
    nativeTranslateX,
    nativeTranslateY,
  ]);

  useEffect(() => {
    if (!fullscreenVisible) {
      setWebViewReady(false);
      setForceNativeFallback(true);
      return;
    }
    setWebViewReady(false);
    setForceNativeFallback(true);
  }, [activeInteractiveSourceKey, fullscreenVisible]);

  useEffect(() => {
    setSelectedMarker(null);
  }, [activeInteractiveSourceKey, selectedLayerId]);

  useEffect(() => {
    nativeTileLoadCountRef.current = 0;
    nativeTileErrorCountRef.current = 0;
  }, [activeInteractiveSourceKey, nativeTiles.length]);

  useEffect(() => {
    if (!fullscreenVisible || !interactiveMapHtml || webViewReady || forceNativeFallback) return;
    const timer = setTimeout(() => {
      setForceNativeFallback(true);
    }, 1800);
    return () => clearTimeout(timer);
  }, [forceNativeFallback, fullscreenVisible, interactiveMapHtml, webViewReady]);

  useEffect(() => {
    if (!fullscreenVisible) return;
    const hasViewport = nativeViewportWidth > 0 && nativeViewportHeight > 0;
    const hasRenderRect = Boolean(nativeRenderRect);

    let targetScale = 1;
    let targetTranslateX = 0;
    let targetTranslateY = 0;
    if (hasViewport && hasRenderRect && nativeRenderRect) {
      const fitScale = Math.min(
        nativeViewportWidth / Math.max(1, nativeRenderRect.width),
        nativeViewportHeight / Math.max(1, nativeRenderRect.height),
      ) * 0.96;
      targetScale = clamp(fitScale, MIN_MAP_SCALE, MAX_MAP_SCALE);
      const sceneCenterX = nativeCanvasSize / 2;
      const sceneCenterY = nativeCanvasSize / 2;
      const rectCenterX = nativeRenderRect.minX + nativeRenderRect.width / 2;
      const rectCenterY = nativeRenderRect.minY + nativeRenderRect.height / 2;
      targetTranslateX = (sceneCenterX - rectCenterX) * targetScale;
      targetTranslateY = (sceneCenterY - rectCenterY) * targetScale;
    }

    runOnUI((nextScale: number, nextTranslateX: number, nextTranslateY: number) => {
      'worklet';
      nativeScale.value = nextScale;
      nativeRotation.value = 0;
      nativeTranslateX.value = nextTranslateX;
      nativeTranslateY.value = nextTranslateY;
      nativeStartScale.value = nextScale;
      nativeStartRotation.value = 0;
      nativeStartTranslateX.value = nextTranslateX;
      nativeStartTranslateY.value = nextTranslateY;
    })(targetScale, targetTranslateX, targetTranslateY);
  }, [
    activeInteractiveSourceKey,
    fullscreenVisible,
    nativeCanvasSize,
    nativeRenderRect,
    nativeRotation,
    nativeScale,
    nativeStartRotation,
    nativeStartScale,
    nativeStartTranslateX,
    nativeStartTranslateY,
    nativeTranslateX,
    nativeTranslateY,
    nativeViewportHeight,
    nativeViewportWidth,
  ]);

  const toggleLegend = useCallback((key: LegendKey) => {
    setLegendVisibility((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  }, []);

  const setAllLegend = useCallback((value: boolean) => {
    const next: Record<LegendKey, boolean> = {
      extracts: value,
      transits: value,
      spawns: value,
      bosses: value,
      lootContainers: value,
      switches: value,
      hazards: value,
    };
    setLegendVisibility(next);
  }, []);

  const handleOpenWiki = useCallback(async () => {
    const wikiLink = String(mapData?.wiki || '').trim();
    if (!wikiLink) return;
    try {
      await Linking.openURL(wikiLink);
    } catch {
      // ignore open-url errors
    }
  }, [mapData?.wiki]);

  const mapTitle = String(mapData?.name || '').trim() || t.mapDetailsTitle;
  const playersText = String(mapData?.players || '').trim() || t.searchUnknown;
  const raidDurationText = Number.isFinite(mapData?.raidDuration)
    ? `${Math.max(0, Math.floor(Number(mapData?.raidDuration ?? 0)))} ${t.searchMapMinutesUnit}`
    : t.searchUnknown;
  const descriptionText = String(mapData?.description || '').trim() || t.searchUnknown;
  const useNativeFallbackMap = true;

  const handleNativeTileLoad = useCallback(() => {
    nativeTileLoadCountRef.current += 1;
  }, []);

  const handleNativeTileError = useCallback(() => {
    nativeTileErrorCountRef.current += 1;
    const errors = nativeTileErrorCountRef.current;
    const loads = nativeTileLoadCountRef.current;
    const totalTiles = nativeTiles.length;
    if (loads > 0) return;
    if (totalTiles <= 0) return;
    if (errors >= totalTiles || errors >= Math.min(totalTiles, 32)) {
      handleInteractiveImageError();
    }
  }, [handleInteractiveImageError, nativeTiles.length]);

  const adjustZoom = useCallback((delta: number) => {
    if (useNativeFallbackMap) {
      runOnUI((value: number) => {
        'worklet';
        const ratio = 1 + value;
        if (ratio <= 0) return;
        const next = nativeScale.value * ratio;
        nativeScale.value = next < MIN_MAP_SCALE ? MIN_MAP_SCALE : next > MAX_MAP_SCALE ? MAX_MAP_SCALE : next;
      })(delta);
      return;
    }
    mapWebViewRef.current?.injectJavaScript(`window.__mapAdjustZoom(${delta}); true;`);
  }, [nativeScale, useNativeFallbackMap]);

  const handleFullscreenMapMessage = useCallback((event: any) => {
    const message = String(event?.nativeEvent?.data || '');
    if (message === 'ready' || message === 'tile-loaded' || message === 'image-loaded') {
      setWebViewReady(true);
      return;
    }
    if (
      message === 'image-error'
      || message === 'tile-error'
      || message === 'resource-error'
      || message === 'js-error'
      || message === 'viewport-zero'
    ) {
      handleInteractiveImageError();
    }
  }, [handleInteractiveImageError]);
  const handlePreviewLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.max(0, Math.floor(event.nativeEvent.layout.width));
    setPreviewWidth((previous) => (Math.abs(previous - width) > 1 ? width : previous));
  }, []);
  const handleNativeViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.max(0, Math.floor(event.nativeEvent.layout.width));
    const height = Math.max(0, Math.floor(event.nativeEvent.layout.height));
    setNativeViewportWidth((previous) => (Math.abs(previous - width) > 1 ? width : previous));
    setNativeViewportHeight((previous) => (Math.abs(previous - height) > 1 ? height : previous));
  }, []);
  const pageBottomInset = Math.max(getDockReservedInset(insets.bottom) + 52, 136);
  const fullscreenTopInset = Math.max(insets.top, 8);
  const fullscreenBottomInset = Math.max(insets.bottom, 8);

  if (mapQuery.isLoading && !mapData) {
    return (
      <>
        <Stack.Screen options={{ title: t.mapDetailsTitle }} />
        <FullscreenSkeleton message={t.searchMapLoading} />
      </>
    );
  }

  if (!mapData) {
    return (
      <View style={styles.centerWrap}>
        <Stack.Screen options={{ title: t.mapDetailsTitle }} />
        <Text style={styles.errorText}>{t.searchMapLoadFailed}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: mapTitle }} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: pageBottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroMain}>
            <Text style={styles.heroTitle}>{mapTitle}</Text>
            <Text style={styles.heroMeta}>{t.searchMapPlayers}: {playersText}</Text>
            <Text style={styles.heroMeta}>{t.searchMapRaidDuration}: {raidDurationText}</Text>
          </View>
          {String(mapData.wiki || '').trim() ? (
            <TouchableOpacity
              style={[styles.wikiButton, { borderColor: accentTheme.accentDim, backgroundColor: accentTheme.accentSoft16 }]}
              activeOpacity={0.75}
              onPress={handleOpenWiki}
            >
              <ExternalLink size={14} color={Colors.gold} />
              <Text style={styles.wikiButtonText}>{t.searchMapOpenWiki}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.overview}</Text>
          <Text style={styles.sectionText}>{descriptionText}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t.searchMapTitle}</Text>
            <TouchableOpacity
              style={[styles.fullscreenButton, { borderColor: accentTheme.accentDim, backgroundColor: accentTheme.accentSoft15 }]}
              onPress={() => setFullscreenVisible(true)}
              activeOpacity={0.75}
            >
              <Maximize2 size={14} color={Colors.gold} />
              <Text style={styles.fullscreenButtonText}>{t.searchMapFullscreen}</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.previewWrap, { height: previewHeight }]} onLayout={handlePreviewLayout}>
            {staticImageUri ? (
              staticSvg ? (
                Platform.OS === 'web' ? (
                  <Image
                    source={{ uri: staticImageUri }}
                    style={styles.previewImage}
                    contentFit="contain"
                    onError={handleStaticImageError}
                  />
                ) : (
                  <WebView
                    key={staticImageUri}
                    source={{ uri: staticImageUri }}
                    originWhitelist={['*']}
                    pointerEvents="none"
                    onError={handleStaticImageError}
                    scrollEnabled={false}
                    style={styles.svgWebView}
                  />
                )
              ) : (
                <Image
                  source={{ uri: staticImageUri }}
                  style={styles.previewImage}
                  contentFit="contain"
                  onError={handleStaticImageError}
                />
              )
            ) : (
              <View style={styles.previewFallback}>
                <Text style={styles.previewFallbackText}>{t.searchMapLoadFailed}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={fullscreenVisible}
        animationType="fade"
        hardwareAccelerated
        statusBarTranslucent
        onRequestClose={() => setFullscreenVisible(false)}
      >
        <View style={styles.fullscreenContainer}>
          <View style={[styles.fullscreenHeader, { paddingTop: fullscreenTopInset + 6 }]}>
            <TouchableOpacity
              style={styles.fullscreenHeaderButton}
              onPress={() => setLegendModalVisible(true)}
              activeOpacity={0.75}
            >
              <ListFilter size={16} color={Colors.text} />
              <Text style={styles.fullscreenHeaderButtonText}>{t.searchMapLegend}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fullscreenHeaderButton}
              onPress={() => setFullscreenVisible(false)}
              activeOpacity={0.75}
            >
              <Minimize2 size={16} color={Colors.text} />
              <Text style={styles.fullscreenHeaderButtonText}>{t.searchMapExitFullscreen}</Text>
            </TouchableOpacity>
          </View>

          {mapLayerOptions.length > 1 ? (
            <View style={styles.layerBarWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerBar}>
                {mapLayerOptions.map((layer) => {
                  const active = selectedLayerId === layer.id;
                  return (
                    <TouchableOpacity
                      key={layer.id}
                      style={[
                        styles.layerChip,
                        active && styles.layerChipActive,
                        active && { borderColor: accentTheme.accentDim, backgroundColor: accentTheme.accentSoft16 },
                      ]}
                      onPress={() => setSelectedLayerId(layer.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.layerChipText, active && styles.layerChipTextActive]}>{localizeLayerLabel(layer.label)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.fullscreenBody}>
            {useNativeFallbackMap ? (
              <GestureDetector gesture={nativeGesture}>
                <View style={styles.nativeMapGestureSurface} onLayout={handleNativeViewportLayout}>
                  <Animated.View
                    style={[
                      styles.nativeMapCanvas,
                      nativeTransformStyle,
                      { width: nativeCanvasSize, height: nativeCanvasSize },
                    ]}
                  >
                    {nativeTileTemplate ? (
                      <View style={styles.nativeMapTiles}>
                        {nativeTiles.map((tile) => (
                          <Image
                            key={tile.id}
                            source={{ uri: tile.uri }}
                            style={[
                              styles.nativeTileImage,
                              {
                                left: tile.x * 256,
                                top: tile.y * 256,
                              },
                            ]}
                            contentFit="cover"
                            onLoad={handleNativeTileLoad}
                            onError={handleNativeTileError}
                          />
                        ))}
                      </View>
                    ) : nativeImageUri ? (
                      <Image
                        source={{ uri: nativeImageUri }}
                        style={styles.nativeMapImage}
                        contentFit="contain"
                        onError={handleInteractiveImageError}
                      />
                    ) : (
                      <View style={styles.centerWrap}>
                        <Text style={styles.errorText}>{t.searchMapLoadFailed}</Text>
                      </View>
                    )}

                    {nativeMarkers.map((marker) => (
                      <TouchableOpacity
                        key={`native-${marker.id}`}
                        style={[
                          styles.mapMarker,
                          {
                            left: marker.left,
                            top: marker.top,
                            backgroundColor: marker.color,
                          },
                        ]}
                        onPress={() => setSelectedMarker({
                          id: marker.id,
                          key: marker.key,
                          title: marker.title,
                          u: 0,
                          v: 0,
                          x: marker.x,
                          y: marker.y,
                          z: marker.z,
                        })}
                        activeOpacity={0.95}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      />
                    ))}
                  </Animated.View>
                </View>
              </GestureDetector>
            ) : (
              <WebView
                ref={mapWebViewRef}
                key={`${interactiveUri || 'none'}|${selectedLayerId || 'na'}|${webMarkers.length}`}
                source={{ html: interactiveMapHtml || '' }}
                originWhitelist={['*']}
                onMessage={handleFullscreenMapMessage}
                onLoad={() => setWebViewReady(true)}
                onError={handleInteractiveImageError}
                onHttpError={handleInteractiveImageError}
                mixedContentMode="always"
                javaScriptEnabled
                domStorageEnabled
                scrollEnabled={false}
                bounces={false}
                overScrollMode="never"
                style={styles.webInteractiveMap}
              />
            )}
          </View>

          <View style={[styles.zoomTools, { bottom: fullscreenBottomInset + 18 }]}>
            <TouchableOpacity style={styles.zoomButton} onPress={() => adjustZoom(0.4)} activeOpacity={0.75}>
              <Plus size={16} color={Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomButton} onPress={() => adjustZoom(-0.4)} activeOpacity={0.75}>
              <Minus size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {legendModalVisible ? (
          <Pressable style={styles.modalBackdrop} onPress={() => setLegendModalVisible(false)}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              {legendDetailKey ? (
                <>
                  <View style={styles.legendDetailHeader}>
                    <TouchableOpacity style={styles.legendActionButton} onPress={() => setLegendDetailKey(null)} activeOpacity={0.75}>
                      <Text style={styles.legendActionText}>{t.searchMapLegendBack}</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>{legendLabelByKey[legendDetailKey]}</Text>
                  </View>

                  <ScrollView style={styles.legendDetailScroll} contentContainerStyle={styles.legendDetailList} showsVerticalScrollIndicator={false}>
                    {legendDetailKey === 'bosses' ? (
                      localizedMapBosses.length > 0 ? (
                        localizedMapBosses.map((boss) => (
                          <View key={`boss-${boss.id}`} style={styles.legendDetailRow}>
                            <View style={styles.legendDetailMain}>
                              <Text style={styles.legendDetailTitle}>{boss.name}</Text>
                              <Text style={styles.legendDetailMeta}>
                                {t.searchMapMarkerSpawnChance}: {boss.spawnChance == null ? '-' : `${Math.round(boss.spawnChance)}%`}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.legendDetailOpenButton}
                              onPress={() => {
                                setLegendModalVisible(false);
                                setLegendDetailKey(null);
                                handleOpenBossDetail(boss.id, boss.name, boss.normalizedName);
                              }}
                              activeOpacity={0.75}
                            >
                              <Text style={styles.legendDetailOpenText}>{t.searchMapMarkerOpenBoss}</Text>
                            </TouchableOpacity>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.legendEmptyText}>{t.searchMapLegendNoEntries}</Text>
                      )
                    ) : (
                      legendDetailMarkers.length > 0 ? (
                        legendDetailMarkers.slice(0, 180).map((marker) => (
                          <TouchableOpacity
                            key={`detail-${legendDetailKey}-${marker.id}`}
                            style={styles.legendDetailRow}
                            onPress={() => {
                              setLegendModalVisible(false);
                              setLegendDetailKey(null);
                              setSelectedMarker(marker);
                            }}
                            activeOpacity={0.8}
                          >
                            <View style={styles.legendDetailMain}>
                              <Text style={styles.legendDetailTitle}>{marker.title}</Text>
                              <Text style={styles.legendDetailMeta}>
                                {t.searchMapMarkerCoordinates}: X {formatCoordinate(marker.x)} / Z {formatCoordinate(marker.z)} / Y {formatCoordinate(marker.y)}
                              </Text>
                            </View>
                            <Text style={styles.legendDetailOpenText}>{t.searchMapMarkerOpenDetails}</Text>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <Text style={styles.legendEmptyText}>{t.searchMapLegendNoEntries}</Text>
                      )
                    )}
                  </ScrollView>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>{t.searchMapLegend}</Text>

                  <View style={styles.legendActions}>
                    <TouchableOpacity style={styles.legendActionButton} onPress={() => setAllLegend(true)} activeOpacity={0.75}>
                      <Text style={styles.legendActionText}>{t.searchMapLegendSelectAll}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.legendActionButton} onPress={() => setAllLegend(false)} activeOpacity={0.75}>
                      <Text style={styles.legendActionText}>{t.searchMapLegendClearAll}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.legendList}>
                    {legendEntries.map((entry) => (
                      <View key={entry.key} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: MARKER_COLORS[entry.key] }]} />
                        <Text style={styles.legendLabel}>{entry.label}</Text>
                        <Text style={styles.legendCount}>{legendCounts[entry.key]}</Text>
                        <TouchableOpacity
                          style={styles.legendDetailButton}
                          onPress={() => setLegendDetailKey(entry.key)}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.legendDetailButtonText}>{t.searchMapLegendDetails}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.legendCheck, legendVisibility[entry.key] && styles.legendCheckActive]}
                          onPress={() => toggleLegend(entry.key)}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.legendCheckText}>{legendVisibility[entry.key] ? t.yes : t.no}</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        ) : null}

        {selectedMarker ? (
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedMarker(null)}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <Text style={styles.modalTitle}>{t.searchMapMarkerDetailsTitle}</Text>

              <View style={styles.markerDetailInfo}>
                <Text style={styles.markerDetailLabel}>
                  {t.searchMapMarkerType}: {legendLabelByKey[selectedMarker.key]}
                </Text>
                <Text style={styles.markerDetailTitle}>{selectedMarker.title}</Text>
                <Text style={styles.markerDetailLabel}>
                  {t.searchMapMarkerCoordinates}: X {formatCoordinate(selectedMarker.x)} / Z {formatCoordinate(selectedMarker.z)} / Y {formatCoordinate(selectedMarker.y)}
                </Text>
              </View>

              <View style={styles.markerDetailSection}>
                <Text style={styles.markerDetailSectionTitle}>{t.searchMapMarkerRelatedTasks}</Text>
                {markerTaskQuery.isFetching && !markerTaskQuery.data ? (
                  <Text style={styles.markerDetailHint}>{t.searchMapLoading}</Text>
                ) : relatedTasks.length > 0 ? (
                  <View style={styles.markerDetailActions}>
                    {relatedTasks.map((task) => (
                      <TouchableOpacity
                        key={`task-link-${selectedMarker.id}-${task.id}`}
                        style={styles.markerDetailActionButton}
                        onPress={() => {
                          setSelectedMarker(null);
                          handleOpenTaskDetail(task);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.markerDetailActionText}>
                          {t.searchMapMarkerOpenTask}: {task.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.markerDetailHint}>{t.searchMapMarkerNoRelatedTasks}</Text>
                )}
              </View>

              {relatedBosses.length > 0 ? (
                <View style={styles.markerDetailSection}>
                  <Text style={styles.markerDetailSectionTitle}>{t.searchMapMarkerRelatedBosses}</Text>
                  <View style={styles.markerDetailActions}>
                    {relatedBosses.map((boss) => (
                      <TouchableOpacity
                        key={`boss-link-${selectedMarker.id}-${boss.id}`}
                        style={styles.markerDetailActionButton}
                        onPress={() => {
                          setSelectedMarker(null);
                          handleOpenBossDetail(boss.id, boss.name, boss.normalizedName);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.markerDetailActionText}>{t.searchMapMarkerOpenBoss}: {boss.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.markerDetailCloseButton}
                onPress={() => setSelectedMarker(null)}
                activeOpacity={0.75}
              >
                <Text style={styles.markerDetailCloseText}>{t.searchMapMarkerClose}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        ) : null}
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  heroCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 12,
    gap: 8,
  },
  heroMain: {
    gap: 4,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  heroMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 12,
    gap: 10,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  sectionText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  wikiButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wikiButtonText: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  fullscreenButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fullscreenButtonText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  previewWrap: {
    width: '100%',
    minHeight: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  svgWebView: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  previewFallback: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  previewFallbackText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  fullscreenHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  fullscreenHeaderButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.04),
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fullscreenHeaderButtonText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  layerBarWrap: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 8,
  },
  layerBar: {
    paddingHorizontal: 14,
    gap: 8,
  },
  layerChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  layerChipActive: {
    borderColor: Colors.goldDim,
    backgroundColor: alphaWhite(0.06),
  },
  layerChipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  layerChipTextActive: {
    color: Colors.text,
  },
  fullscreenBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nativeMapGestureSurface: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  nativeMapCanvas: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  nativeMapTiles: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  nativeTileImage: {
    position: 'absolute',
    width: 256,
    height: 256,
  },
  nativeMapImage: {
    width: '100%',
    height: '100%',
  },
  webInteractiveMap: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.background,
  },
  mapTransformLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapMarker: {
    position: 'absolute',
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: alphaBlack(0.65),
    shadowColor: '#000000',
    shadowOpacity: 0.32,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  zoomTools: {
    position: 'absolute',
    right: 16,
    bottom: 26,
    gap: 10,
  },
  zoomButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaBlack(0.65),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: alphaBlack(0.75),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 14,
    gap: 12,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  legendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  legendActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  legendActionText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  legendList: {
    gap: 8,
  },
  legendDetailScroll: {
    maxHeight: 420,
  },
  legendDetailList: {
    gap: 8,
  },
  legendRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.02),
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  legendDetailButton: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  legendDetailButtonText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  legendCount: {
    color: Colors.textSecondary,
    fontSize: 12,
    minWidth: 28,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  legendCheck: {
    minWidth: 34,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  legendCheckActive: {
    borderColor: Colors.gold,
    backgroundColor: alphaWhite(0.05),
  },
  legendCheckText: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '700' as const,
    lineHeight: 14,
  },
  legendDetailRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.02),
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDetailMain: {
    flex: 1,
    gap: 4,
  },
  legendDetailTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  legendDetailMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  legendDetailOpenButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  legendDetailOpenText: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  legendEmptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
  },
  markerDetailInfo: {
    gap: 6,
  },
  markerDetailLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  markerDetailTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  markerDetailSection: {
    gap: 8,
  },
  markerDetailSectionTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  markerDetailActions: {
    gap: 8,
  },
  markerDetailActionButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  markerDetailActionText: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  markerDetailHint: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  markerDetailCloseButton: {
    alignSelf: 'flex-end',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  markerDetailCloseText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
});
