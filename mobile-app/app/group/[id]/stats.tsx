import React from 'react';
import { View, Dimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { TrendingUp, PieChart as PieIcon, BarChart3, Receipt } from 'lucide-react-native';
import { useGroupDetails } from '../../../src/hooks/useGroupDetails';
import { useThemeColors } from '../../../src/theme';
import { formatCurrency, formatFullDate } from '../../../src/utils/format';
import { Screen, GlassCard, GlassText, ListItem, Loader } from '../../../src/components/ui';

const screenWidth = Dimensions.get('window').width;

// Fixed, distinct palette for per-member chart slices (indexed by member order).
const CHART_COLORS = [
  '#FF512F',
  '#DD2476',
  '#10B981',
  '#3B82F6',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
];

export default function StatsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams();
  const { expenses, members, loading } = useGroupDetails(id);

  if (loading) return <Loader fullscreen />;

  const userExpenses = members.map((member, index) => {
    const total = expenses
      .filter((exp) => exp.payer_id === member.user_id)
      .reduce((sum, exp) => sum + exp.amount, 0);
    return {
      name: member.full_name?.split(' ')[0] ?? '',
      amount: total,
      // Stable palette (indexed by member) — avoids invalid short hex from
      // Math.random().toString(16) and stops colors flickering on re-render.
      color: CHART_COLORS[index % CHART_COLORS.length],
      legendFontColor: colors.contentMuted,
      legendFontSize: 12,
    };
  });

  const chartConfig = {
    backgroundGradientFrom: colors.content,
    backgroundGradientTo: colors.content,
    color: (opacity = 1) => `rgba(255, 81, 47, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.6,
    useShadowColorFromDataset: false,
    propsForLabels: { fontFamily: 'Outfit_500Medium' },
  };

  const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const hasData = userExpenses.some((u) => u.amount > 0);

  return (
    <Screen title={t('stats.title')} showBack contentClassName="px-6 pt-4 pb-32">
      <GlassCard intensity={45} className="mb-8" padding="p-6">
        <View className="mb-4 flex-row items-center justify-between">
          <View className="h-12 w-12 items-center justify-center rounded-2xl border border-accent/30 bg-accent/20">
            <TrendingUp size={24} color={colors.accent} />
          </View>
          <GlassText variant="caption" className="tracking-widest">
            {t('stats.totalSpent')}
          </GlassText>
        </View>
        <GlassText className="font-outfit-bold text-4xl">{formatCurrency(totalSpent)}</GlassText>
      </GlassCard>

      <View className="mb-8">
        <View className="mb-4 ml-1 flex-row items-center">
          <BarChart3 size={20} color={colors.contentMuted} />
          <GlassText variant="h3" className="ml-2">
            {t('stats.byMember')}
          </GlassText>
        </View>
        <GlassCard intensity={20} className="items-center" padding="p-4">
          {hasData ? (
            <BarChart
              data={{
                labels: userExpenses.map((u) => u.name),
                datasets: [{ data: userExpenses.map((u) => u.amount / 1000) }],
              }}
              width={screenWidth - 80}
              height={220}
              yAxisLabel=""
              yAxisSuffix="k"
              chartConfig={chartConfig}
              verticalLabelRotation={0}
              fromZero
              style={{ borderRadius: 16 }}
            />
          ) : (
            <View className="items-center py-10">
              <GlassText className="text-content-faint">{t('stats.noSpendData')}</GlassText>
            </View>
          )}
        </GlassCard>
      </View>

      <View className="mb-10">
        <View className="mb-4 ml-1 flex-row items-center">
          <PieIcon size={20} color={colors.contentMuted} />
          <GlassText variant="h3" className="ml-2">
            {t('stats.contributionRatio')}
          </GlassText>
        </View>
        <GlassCard intensity={20} className="items-center" padding="p-4">
          {hasData ? (
            <PieChart
              data={userExpenses}
              width={screenWidth - 80}
              height={200}
              chartConfig={chartConfig}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          ) : (
            <View className="items-center py-10">
              <GlassText className="text-content-faint">{t('stats.noContribData')}</GlassText>
            </View>
          )}
        </GlassCard>
      </View>

      <View className="mb-10">
        <View className="mb-6 ml-1 flex-row items-center">
          <Receipt size={20} color={colors.contentMuted} />
          <GlassText variant="h3" className="ml-2">
            {t('stats.recentDetails')}
          </GlassText>
        </View>
        {expenses.slice(0, 5).map((exp, idx) => (
          <ListItem
            key={exp.expense_id}
            intensity={15}
            title={exp.description || t('expenses.untitled')}
            subtitle={formatFullDate(exp.created_at)}
            className="mb-3"
            leading={
              <View className="mr-4 h-10 w-10 items-center justify-center rounded-xl border border-surface-line bg-surface-fill">
                <GlassText className="font-outfit-bold text-[10px] text-content-faint">
                  {idx + 1}
                </GlassText>
              </View>
            }
            trailing={
              <GlassText className="font-outfit-bold">{formatCurrency(exp.amount)}</GlassText>
            }
          />
        ))}
      </View>
    </Screen>
  );
}
