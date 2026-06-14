import React, { useCallback } from 'react';
import { View, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus, UserPlus, Search, Users2 } from 'lucide-react-native';
import { useGroupList } from '../../src/hooks/useGroupList';
import { useThemeColors } from '../../src/theme';
import {
  Screen,
  Input,
  Button,
  IconButton,
  EmptyState,
  GroupCard,
  Loader,
} from '../../src/components/ui';

export default function GroupsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const { filteredGroups, loading, refreshing, searchQuery, fetchGroups, onRefresh, handleSearch } =
    useGroupList();

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, [fetchGroups])
  );

  return (
    <Screen
      title={t('groups.title')}
      headerRight={
        <View className="flex-row gap-3">
          <IconButton icon={UserPlus} onPress={() => router.push('/join-group')} />
          <IconButton icon={Plus} onPress={() => router.push('/create-group')} />
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      <View className="mb-6">
        <Input
          icon={Search}
          placeholder={t('groups.searchPlaceholder')}
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {loading ? (
        <Loader className="mt-10" />
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          icon={Users2}
          title={searchQuery ? t('groups.noResultsTitle') : t('groups.emptyTitle')}
          description={searchQuery ? t('groups.noResultsDesc') : t('groups.emptyDesc')}
          className="mt-4"
          action={
            searchQuery ? undefined : (
              <View className="flex-row gap-4">
                <Button
                  title={t('groups.create')}
                  className="flex-1"
                  onPress={() => router.push('/create-group')}
                />
                <Button
                  title={t('groups.join')}
                  variant="secondary"
                  className="flex-1"
                  onPress={() => router.push('/join-group')}
                />
              </View>
            )
          }
        />
      ) : (
        <View className="pb-32">
          {filteredGroups.map((item) => (
            <GroupCard
              key={item.group_id}
              group={item}
              onPress={() => router.push(`/group/${item.group_id}`)}
              className="mb-4"
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

