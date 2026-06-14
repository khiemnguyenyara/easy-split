import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Receipt } from 'lucide-react-native';
import { useThemeColors } from '../../theme';
import { formatCurrency, formatDate } from '../../utils/format';
import { EXPENSE_CATEGORY_IDS } from '../../constants';
import { GlassText } from './GlassText';
import type { GroupExpense, FeedExpense } from '../../types/models';

export interface ExpenseCardProps {
  expense: GroupExpense | FeedExpense;
  showGroup?: boolean;
  index?: number;
  onPress?: () => void;
  className?: string;
}

export const ExpenseCard: React.FC<ExpenseCardProps> = ({
  expense,
  showGroup = false,
  index,
  onPress,
  className = '',
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const isFeedExpense = 'group_name' in expense;

  const payerName = isFeedExpense
    ? (expense as FeedExpense).payer_name
    : (expense as GroupExpense).profiles?.full_name;
  const shortName = payerName?.split(' ')[0] || '';

  const dateStr = formatDate(expense.created_at);

  const categoryStr = expense.category
    ? ` • ${
        (EXPENSE_CATEGORY_IDS as readonly string[]).includes(expense.category)
          ? t(`category.${expense.category}`)
          : expense.category
      }`
    : '';

  const subtitle = showGroup
    ? `${(expense as FeedExpense).group_name || ''} • ${dateStr}`
    : t('groupDetail.expenseBy', {
        name: shortName,
        date: dateStr,
      }) + categoryStr;

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      className={`mb-3 flex-row items-center rounded-2xl border border-surface-line bg-surface-fill p-4 ${className}`}
    >
      <View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl border border-surface-line bg-surface-glass">
        {index !== undefined ? (
          <GlassText className="font-outfit-bold text-sm text-content-faint">
            {index}
          </GlassText>
        ) : (
          <Receipt size={22} color={colors.content} />
        )}
      </View>

      <View className="flex-1">
        <GlassText className="font-outfit-bold text-base" numberOfLines={1}>
          {expense.description || t('expenses.untitled')}
        </GlassText>
        <GlassText variant="caption" className="mt-0.5" numberOfLines={1}>
          {subtitle}
        </GlassText>
      </View>

      <GlassText className="ml-3 font-outfit-bold text-base">
        {formatCurrency(expense.amount)}
      </GlassText>
    </Container>
  );
};
