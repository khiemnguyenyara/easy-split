import React from 'react';
import { View, ViewProps } from 'react-native';
import { GlassText } from './GlassText';

type Size = 'sm' | 'md' | 'lg';

interface AvatarProps extends ViewProps {
  name?: string | null;
  size?: Size;
  active?: boolean;
  className?: string;
}

const SIZE: Record<Size, { box: string; text: string }> = {
  sm: { box: 'w-8 h-8', text: 'text-[10px]' },
  md: { box: 'w-10 h-10', text: 'text-sm' },
  lg: { box: 'w-12 h-12', text: 'text-base' },
};

const initials = (name?: string | null) => (name ?? '?').trim().charAt(0).toUpperCase() || '?';

export const Avatar = ({
  name,
  size = 'md',
  active = false,
  className = '',
  ...props
}: AvatarProps) => {
  const s = SIZE[size];
  return (
    <View
      className={`items-center justify-center rounded-full border border-surface-line ${s.box} ${
        active ? 'bg-accent/20' : 'bg-white dark:bg-[#201D47]'
      } ${className}`}
      {...props}
    >
      <GlassText
        className={`font-outfit-bold ${s.text} ${active ? 'text-accent' : 'text-content'}`}
      >
        {initials(name)}
      </GlassText>
    </View>
  );
};
