import React, { useCallback, useState } from 'react';
import { View, RefreshControl, Alert, TouchableOpacity, Text } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  LogIn,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  LogOut,
  Bell,
} from 'lucide-react-native';
import { useHomeDashboard } from '../../src/hooks/useHomeDashboard';
import { groupService } from '../../src/services/group.service';
import { useThemeColors, accentGradient } from '../../src/theme';
import { formatCurrency } from '../../src/utils/format';
import {
  Screen,
  GlassCard,
  GlassText,
  StatTile,
  EmptyState,
  Badge,
  IconButton,
  Loader,
  GroupCard,
} from '../../src/components/ui';

export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const {
    user,
    signOut,
    groups,
    totalBalance,
    owedToUser,
    userOwes,
    loading,
    refreshing,
    fetchData,
    onRefresh,
  } = useHomeDashboard();

  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      fetchData();
      groupService
        .getUnreadNotificationCount()
        .then(setUnread)
        .catch(() => setUnread(0));
    }, [fetchData])
  );

  const handleSignOut = () => {
    Alert.alert(
      t('common.signOut'),
      t('common.signOutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.signOut'), style: 'destructive', onPress: signOut },
      ],
      { cancelable: true }
    );
  };

  return (
    <Screen
      title={user?.user_metadata?.full_name || t('common.user')}
      subtitle={t('home.greeting')}
      headerRight={
        <View className="flex-row items-center gap-2">
          <View>
            <IconButton icon={Bell} onPress={() => router.push('/notifications')} />
            {unread > 0 ? (
              <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full border border-surface-glass bg-accent px-1">
                <Text
                  className="font-outfit-bold text-[10px] text-white text-center leading-none"
                  style={{ includeFontPadding: false, textAlignVertical: 'center' }}
                >
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            ) : null}
          </View>
          <IconButton icon={LogOut} onPress={handleSignOut} />
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      overlay={
        <View className="absolute bottom-32 right-6 flex-col gap-4 items-end">
          <IconButton
            icon={LogIn}
            iconSize={24}
            onPress={() => router.push('/join-group')}
            className="h-14 w-14 rounded-2xl shadow-xl"
          />
          <TouchableOpacity
            onPress={() => router.push('/create-group')}
            activeOpacity={0.85}
            className="h-14 w-14 overflow-hidden rounded-2xl shadow-xl shadow-accent/30"
          >
            <LinearGradient
              colors={accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="flex-1 items-center justify-center"
            >
              <Plus size={24} color={colors.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      }
    >
      <GlassCard intensity={45} className="mb-8">
        <View className="mb-8 flex-row items-start justify-between">
          <View>
            <GlassText variant="caption" className="mb-1">
              {t('home.totalBalance')}
            </GlassText>
            <GlassText className="font-outfit-bold text-4xl">
              {totalBalance < 0 ? '-' : ''}
              {formatCurrency(totalBalance, { abs: true })}
            </GlassText>
          </View>
          <View className="rounded-2xl border border-accent/30 bg-accent/20 p-4">
            <Wallet size={24} color={colors.accent} />
          </View>
        </View>

        <View className="flex-row gap-4">
          <StatTile
            icon={ArrowDownLeft}
            tone="success"
            label={t('home.youAreOwed')}
            value={formatCurrency(owedToUser, { abs: true })}
          />
          <StatTile
            icon={ArrowUpRight}
            tone="danger"
            label={t('home.youOwe')}
            value={formatCurrency(userOwes, { abs: true })}
          />
        </View>
      </GlassCard>

      <View className="mb-6 flex-row items-center justify-between">
        <GlassText variant="h3">{t('home.yourGroups')}</GlassText>
        {groups.length > 0 ? (
          <Badge label={t('home.activeGroups', { count: groups.length })} />
        ) : null}
      </View>

      {loading ? (
        <Loader className="mt-10" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('home.noGroupsTitle')}
          description={t('home.noGroupsDesc')}
          actionLabel={t('home.createGroupNow')}
          onAction={() => router.push('/create-group')}
        />
      ) : (
        groups.map((item) => (
          <GroupCard
            key={item.group_id}
            group={item}
            onPress={() => router.push(`/group/${item.group_id}`)}
            className="mb-4"
          />
        ))
      )}
    </Screen>
  );
}
