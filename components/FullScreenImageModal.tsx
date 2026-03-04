import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View, type LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { clamp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Colors, { alphaBlack, alphaWhite } from '@/constants/colors';

interface FullScreenImageModalProps {
  visible: boolean;
  uri?: string | null;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export default function FullScreenImageModal({ visible, uri, onClose }: FullScreenImageModalProps) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: window.width, height: window.height });
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const frameWidthSV = useSharedValue(1);
  const frameHeightSV = useSharedValue(1);
  const viewportWidthSV = useSharedValue(window.width);
  const viewportHeightSV = useSharedValue(window.height);

  useEffect(() => {
    setViewport({ width: window.width, height: window.height });
    viewportWidthSV.value = window.width;
    viewportHeightSV.value = window.height;
  }, [viewportHeightSV, viewportWidthSV, window.height, window.width]);

  useEffect(() => {
    setImageSize(null);
    if (!uri) return;
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (cancelled) return;
        if (width > 0 && height > 0) {
          setImageSize({ width, height });
        }
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const frame = useMemo(() => {
    const fallbackSide = Math.max(160, Math.min(viewport.width * 0.78, viewport.height * 0.58));
    if (!imageSize || imageSize.width <= 0 || imageSize.height <= 0) {
      return {
        width: fallbackSide,
        height: fallbackSide,
      };
    }

    const maxWidth = Math.max(140, viewport.width * 0.9);
    const maxHeight = Math.max(140, viewport.height * 0.72);
    const aspect = imageSize.width / imageSize.height;

    if (maxWidth / maxHeight > aspect) {
      const height = maxHeight;
      return {
        width: Math.max(90, height * aspect),
        height,
      };
    }

    const width = maxWidth;
    return {
      width,
      height: Math.max(90, width / aspect),
    };
  }, [imageSize, viewport.height, viewport.width]);

  useEffect(() => {
    frameWidthSV.value = frame.width;
    frameHeightSV.value = frame.height;
  }, [frame.height, frame.width, frameHeightSV, frameWidthSV]);

  useEffect(() => {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
  }, [scale, translateX, translateY, uri, visible]);

  const handleViewerLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setViewport({ width, height });
      viewportWidthSV.value = width;
      viewportHeightSV.value = height;
    }
  }, [viewportHeightSV, viewportWidthSV]);

  const handleImageLoad = useCallback((event: { nativeEvent: { source?: { width?: number; height?: number } } }) => {
    const width = event.nativeEvent.source?.width ?? 0;
    const height = event.nativeEvent.source?.height ?? 0;
    if (width > 0 && height > 0) {
      setImageSize({ width, height });
    }
  }, []);

  const pinchGesture = useMemo(() => Gesture.Pinch()
    .onBegin(() => {
      pinchStartScale.value = scale.value;
    })
    .onUpdate((event) => {
      const nextScale = clamp(pinchStartScale.value * event.scale, MIN_SCALE, MAX_SCALE);
      scale.value = nextScale;
      const maxX = Math.max(0, (frameWidthSV.value * nextScale - viewportWidthSV.value) / 2);
      const maxY = Math.max(0, (frameHeightSV.value * nextScale - viewportHeightSV.value) / 2);
      translateX.value = clamp(translateX.value, -maxX, maxX);
      translateY.value = clamp(translateY.value, -maxY, maxY);
    })
    .onEnd(() => {
      if (scale.value <= 1.01) {
        scale.value = withTiming(1, { duration: 140 });
        translateX.value = withTiming(0, { duration: 140 });
        translateY.value = withTiming(0, { duration: 140 });
        return;
      }
      const maxX = Math.max(0, (frameWidthSV.value * scale.value - viewportWidthSV.value) / 2);
      const maxY = Math.max(0, (frameHeightSV.value * scale.value - viewportHeightSV.value) / 2);
      translateX.value = withTiming(clamp(translateX.value, -maxX, maxX), { duration: 120 });
      translateY.value = withTiming(clamp(translateY.value, -maxY, maxY), { duration: 120 });
    }), [frameHeightSV, frameWidthSV, pinchStartScale, scale, translateX, translateY, viewportHeightSV, viewportWidthSV]);

  const panGesture = useMemo(() => Gesture.Pan()
    .onBegin(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      const currentScale = scale.value;
      if (currentScale <= 1.01) {
        translateX.value = 0;
        translateY.value = 0;
        return;
      }
      const maxX = Math.max(0, (frameWidthSV.value * currentScale - viewportWidthSV.value) / 2);
      const maxY = Math.max(0, (frameHeightSV.value * currentScale - viewportHeightSV.value) / 2);
      translateX.value = clamp(panStartX.value + event.translationX, -maxX, maxX);
      translateY.value = clamp(panStartY.value + event.translationY, -maxY, maxY);
    })
    .onEnd(() => {
      const currentScale = scale.value;
      if (currentScale <= 1.01) {
        translateX.value = withTiming(0, { duration: 120 });
        translateY.value = withTiming(0, { duration: 120 });
        return;
      }
      const maxX = Math.max(0, (frameWidthSV.value * currentScale - viewportWidthSV.value) / 2);
      const maxY = Math.max(0, (frameHeightSV.value * currentScale - viewportHeightSV.value) / 2);
      translateX.value = withTiming(clamp(translateX.value, -maxX, maxX), { duration: 120 });
      translateY.value = withTiming(clamp(translateY.value, -maxY, maxY), { duration: 120 });
    }), [frameHeightSV, frameWidthSV, panStartX, panStartY, scale, translateX, translateY, viewportHeightSV, viewportWidthSV]);

  const gesture = useMemo(() => Gesture.Simultaneous(pinchGesture, panGesture), [panGesture, pinchGesture]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      hardwareAccelerated
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

          <View style={styles.viewer} onLayout={handleViewerLayout} pointerEvents="box-none">
            {uri ? (
              <GestureDetector gesture={gesture}>
                <Animated.View
                  style={[
                    styles.imageFrame,
                    { width: frame.width, height: frame.height },
                    animatedStyle,
                  ]}
                  renderToHardwareTextureAndroid
                >
                  <Image
                    source={{ uri }}
                    style={styles.image}
                    resizeMode="contain"
                    onLoad={handleImageLoad}
                  />
                </Animated.View>
              </GestureDetector>
            ) : null}
          </View>

          <Pressable
            style={[styles.closeButton, { top: insets.top + 12, right: 12 }]}
            onPress={onClose}
            hitSlop={10}
          >
            <X size={20} color={Colors.text} />
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: alphaBlack(0.94),
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  imageFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: alphaWhite(0.14),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
