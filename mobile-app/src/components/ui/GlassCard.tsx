import React from 'react';
import { View, StyleSheet, ViewProps, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '../../store/useThemeStore';

/**
 * Opaque base behind the translucent sheen — approximates the average page
 * background per theme. Replaces a live BlurView so cards don't flicker when a
 * screen slides in/out (iOS pauses blur during transitions, causing a snap).
 */
const BASE_BG = {
  light: '#F6F5EE',
  dark: '#15122A',
};

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  /** No longer used (blur was removed to avoid flicker); kept for API compatibility. */
  intensity?: number;
  /** Tailwind padding applied to the inner content. Set '' to opt out. */
  padding?: string;
  className?: string;
  backgroundImageUri?: string;
}

const splitClassName = (className: string) => {
  const classes = className.split(/\s+/).filter(Boolean);
  const outer: string[] = [];
  const inner: string[] = [];
  classes.forEach((c) => {
    if (
      c.startsWith('m-') ||
      c.startsWith('mx-') ||
      c.startsWith('my-') ||
      c.startsWith('mt-') ||
      c.startsWith('mr-') ||
      c.startsWith('mb-') ||
      c.startsWith('ml-') ||
      c.startsWith('w-') ||
      c.startsWith('h-') ||
      c.startsWith('max-w-') ||
      c.startsWith('max-h-') ||
      c.startsWith('min-w-') ||
      c.startsWith('min-h-') ||
      c === 'absolute' ||
      c === 'relative' ||
      c.startsWith('top-') ||
      c.startsWith('bottom-') ||
      c.startsWith('left-') ||
      c.startsWith('right-') ||
      c.startsWith('z-') ||
      c.startsWith('self-') ||
      c === 'flex-1' ||
      c === 'flex-none' ||
      c === 'flex-auto' ||
      c.startsWith('grow') ||
      c.startsWith('shrink') ||
      c.startsWith('basis-') ||
      c === 'hidden'
    ) {
      outer.push(c);
    } else {
      inner.push(c);
    }
  });
  return { outer: outer.join(' '), inner: inner.join(' ') };
};

export const GlassCard = ({
  children,
  intensity = 20,
  padding = 'p-6',
  className = '',
  style,
  backgroundImageUri,
  ...props
}: GlassCardProps) => {
  const scheme = useThemeStore((s) => s.scheme);
  const { outer, inner } = splitClassName(className);

  return (
    <View
      className={outer}
      style={[
        {
          shadowColor: scheme === 'dark' ? '#000000' : '#1E1B4B',
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: scheme === 'dark' ? 0.32 : 0.08,
          shadowRadius: 24,
          elevation: 8,
        },
        style,
      ]}
      {...props}
    >
      <View className={`overflow-hidden rounded-[32px] border border-surface-line ${inner}`}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: BASE_BG[scheme] }]} />
        {backgroundImageUri && (
          <Image
            source={{ uri: backgroundImageUri }}
            style={[StyleSheet.absoluteFill, { opacity: scheme === 'dark' ? 0.2 : 0.35 }]}
            resizeMode="cover"
          />
        )}
        <LinearGradient
          colors={
            scheme === 'dark'
              ? ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.01)', 'rgba(0, 0, 0, 0.15)']
              : ['rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.08)', 'rgba(30, 27, 75, 0.02)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View className={`bg-surface-glass ${padding}`}>{children}</View>
      </View>
    </View>
  );
};
