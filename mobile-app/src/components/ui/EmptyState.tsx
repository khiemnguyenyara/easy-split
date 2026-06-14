import React from 'react';
import { View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { useThemeColors } from '../../theme';
import { GlassText } from './GlassText';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Custom action area (overrides actionLabel/onAction). */
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  action,
  className = '',
}: EmptyStateProps) => {
  const colors = useThemeColors();
  return (
    <View className={`items-center justify-center py-12 px-6 ${className}`}>
      <View className="mb-6 h-16 w-16 items-center justify-center rounded-3xl border border-surface-line bg-surface-fill">
        <Icon size={32} color={colors.contentFaint} />
      </View>
      <GlassText variant="h3" className="mb-2 text-center">
        {title}
      </GlassText>
      {description ? (
        <GlassText variant="body" className="px-4 text-center text-content-faint">
          {description}
        </GlassText>
      ) : null}
      {action ? (
        <View className="mt-8 w-full">{action}</View>
      ) : actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} className="mt-8 w-full" />
      ) : null}
    </View>
  );
};
