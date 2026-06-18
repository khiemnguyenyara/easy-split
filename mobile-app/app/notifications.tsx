import React, { useCallback } from 'react';
import { View, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  BellOff,
  Receipt,
  Wallet,
  Bell,
  MessageCircle,
  MoreVertical,
  UserPlus,
  Clock,
} from 'lucide-react-native';
import { useNotifications, AppNotification } from '../src/hooks/useNotifications';
import { useThemeColors } from '../src/theme';
import { Screen, GlassText, EmptyState, Loader } from '../src/components/ui';
import { formatCurrency } from '../src/utils/format';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const {
    notifications,
    loading,
    refreshing,
    fetchData,
    onRefresh,
    markAllRead,
    markOneRead,
    removeNotification,
  } = useNotifications();

  const openActions = (n: AppNotification) => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (!n.is_read) {
      buttons.push({ text: t('notif.markRead'), onPress: () => markOneRead(n.notification_id) });
    }
    buttons.push({
      text: t('notif.delete'),
      style: 'destructive',
      onPress: () => removeNotification(n.notification_id),
    });
    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(t('notif.actionsTitle'), undefined, buttons);
  };

  // Load on focus and mark all read immediately so the home badge clears when going back.
  useFocusEffect(
    useCallback(() => {
      const loadAndMark = async () => {
        await fetchData();
        await markAllRead();
      };
      loadAndMark();
    }, [fetchData, markAllRead])
  );

  const render = (n: AppNotification) => {
    const p = n.data || {};
    switch (p.type) {
      case 'expense_added':
        return {
          icon: Receipt,
          title: t('notif.expenseAddedTitle'),
          body: t('notif.expenseAddedBody', {
            actor: p.actor || t('common.user'),
            group: p.group_name || '',
          }),
        };
      case 'settlement_submitted':
        return {
          icon: Wallet,
          title: t('notif.settlementSubmittedTitle'),
          body: t('notif.settlementSubmittedBody', { actor: p.actor || t('common.user') }),
        };
      case 'settlement_confirmed':
        return {
          icon: Wallet,
          title: t('notif.settlementConfirmedTitle'),
          body: t('notif.settlementConfirmedBody'),
        };
      case 'message_received':
        return {
          icon: MessageCircle,
          title: t('notif.messageReceivedTitle'),
          body: t('notif.messageReceivedBody', {
            actor: p.actor || t('common.user'),
            group: p.group_name || '',
          }),
        };
      case 'member_added':
        return {
          icon: UserPlus,
          title: t('notif.memberAddedTitle'),
          body: t('notif.memberAddedBody', {
            actor: p.actor || t('common.user'),
            group: p.group_name || '',
          }),
        };
      case 'debt_reminder':
        return {
          icon: Clock,
          title: t('notif.debtReminderTitle'),
          body: t('notif.debtReminderBody', {
            actor: p.actor || t('common.user'),
            group: p.group_name || '',
            amount: formatCurrency(p.amount || 0),
          }),
        };
      default:
        return { icon: Bell, title: n.title, body: n.message };
    }
  };

  const formatTime = (d: string | null) =>
    d
      ? new Date(d).toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

  return (
    <Screen
      title={t('notifications.title')}
      showBack
      contentClassName="px-6 pt-4 pb-32"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      {loading ? (
        <Loader className="mt-10" />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={t('notifications.emptyTitle')}
          description={t('notifications.emptyDesc')}
          className="mt-10"
        />
      ) : (
        notifications.map((n) => {
          const { icon: Icon, title, body } = render(n);
          const unread = !n.is_read;
          const groupId = n.data?.group_id;
          return (
            <TouchableOpacity
              key={n.notification_id}
              activeOpacity={0.7}
              disabled={!groupId}
              onPress={() => groupId && router.push(`/group/${groupId}`)}
              className={`mb-3 flex-row items-start rounded-2xl border p-4 ${
                unread ? 'border-accent/30 bg-accent/5' : 'border-surface-line bg-surface-fill'
              }`}
            >
              <View
                className={`mr-3 h-10 w-10 items-center justify-center rounded-xl ${
                  unread ? 'bg-accent/20' : 'border border-surface-line bg-surface-glass'
                }`}
              >
                <Icon size={18} color={unread ? colors.accent : colors.content} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <GlassText className="flex-1 font-outfit-bold text-sm" numberOfLines={1}>
                    {title}
                  </GlassText>
                  {unread ? <View className="ml-2 h-2 w-2 rounded-full bg-accent" /> : null}
                </View>
                <GlassText variant="caption" className="mt-0.5 normal-case leading-5">
                  {body}
                </GlassText>
                <GlassText variant="caption" className="mt-1 text-[10px] opacity-50">
                  {formatTime(n.created_at)}
                </GlassText>
              </View>
              {n.data?.type !== 'debt_reminder' && (
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => openActions(n)}
                  className="-mr-1 ml-1 h-8 w-8 items-center justify-center rounded-full"
                >
                  <MoreVertical size={18} color={colors.contentFaint} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })
      )}
    </Screen>
  );
}
