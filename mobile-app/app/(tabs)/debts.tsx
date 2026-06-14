import React, { useCallback } from 'react';
import { View, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Wallet, ArrowDownLeft, ArrowUpRight, Users } from 'lucide-react-native';
import { useDebtsOverview } from '../../src/hooks/useDebtsOverview';
import { useThemeColors } from '../../src/theme';
import { formatCurrency } from '../../src/utils/format';
import { getGroupBgImage } from '../../src/utils/image';
import {
  Screen,
  GlassCard,
  GlassText,
  StatTile,
  ListItem,
  EmptyState,
  Loader,
} from '../../src/components/ui';

export default function DebtsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const { byGroup, totals, loading, refreshing, fetchData, onRefresh } = useDebtsOverview();

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const settled = totals.owedToUser === 0 && totals.userOwes === 0 && byGroup.length === 0;

  return (
    <Screen
      title={t('debts.title')}
      contentClassName="px-6 pt-4 pb-32"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      {loading ? (
        <Loader className="mt-10" />
      ) : settled ? (
        <EmptyState
          icon={Wallet}
          title={t('debts.balancedTitle')}
          description={t('debts.balancedDesc')}
          className="mt-10"
        />
      ) : (
        <View>
          <GlassCard intensity={45} className="mb-8">
            <View className="flex-row gap-4">
              <StatTile
                icon={ArrowDownLeft}
                tone="success"
                label={t('debts.owedToYou')}
                value={formatCurrency(totals.owedToUser, { abs: true })}
              />
              <StatTile
                icon={ArrowUpRight}
                tone="danger"
                label={t('debts.youOwe')}
                value={formatCurrency(totals.userOwes, { abs: true })}
              />
            </View>
          </GlassCard>

          <GlassText variant="caption" className="mb-4 ml-1 tracking-widest">
            {t('debts.byGroup')}
          </GlassText>

          {byGroup.map((g) => {
            const positive = g.net > 0;
            return (
              <ListItem
                key={g.group_id}
                icon={Users}
                title={g.group_name}
                backgroundImageUri={getGroupBgImage(g.group_id)}
                onPress={() => router.push(`/group/${g.group_id}`)}
                className="mb-4"
                subtitle={
                  <GlassText
                    variant="caption"
                    className={`mt-0.5 ${positive ? 'text-success' : 'text-danger'}`}
                  >
                    {positive ? t('groupDetail.balanceOwed') : t('groupDetail.balanceOwe')}
                  </GlassText>
                }
                trailing={
                  <GlassText
                    variant="h3"
                    className={`text-lg ${positive ? 'text-success' : 'text-danger'}`}
                  >
                    {positive ? '+' : '-'}
                    {formatCurrency(g.net, { abs: true })}
                  </GlassText>
                }
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}
