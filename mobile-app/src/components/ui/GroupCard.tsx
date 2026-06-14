import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react-native';
import { getGroupBgImage } from '../../utils/image';
import { ListItem } from './ListItem';
import { Badge } from './Badge';
import { GlassText } from './GlassText';

export interface GroupData {
  group_id: string;
  group_name: string;
  description: string | null;
  member_count: number;
}

export interface GroupCardProps {
  group: GroupData;
  onPress?: () => void;
  className?: string;
}

export const GroupCard: React.FC<GroupCardProps> = ({
  group,
  onPress,
  className = '',
}) => {
  const { t } = useTranslation();

  return (
    <ListItem
      icon={Users}
      title={group.group_name}
      backgroundImageUri={getGroupBgImage(group.group_id)}
      onPress={onPress}
      className={className}
      subtitle={
        <View className="mt-1 flex-row items-center">
          <Badge
            label={t('common.memberCount', { count: group.member_count })}
            tone="accent"
          />
          {group.description ? (
            <GlassText variant="caption" className="ml-3 flex-1" numberOfLines={1}>
              {group.description}
            </GlassText>
          ) : null}
        </View>
      }
    />
  );
};
