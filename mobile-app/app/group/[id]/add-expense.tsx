import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Receipt,
  Check,
  ShoppingBag,
  Utensils,
  Car,
  Coffee,
  MoreHorizontal,
  LucideIcon,
} from 'lucide-react-native';
import { useAddExpense } from '../../../src/hooks/useAddExpense';
import { useThemeColors } from '../../../src/theme';
import { EXPENSE_CATEGORY_IDS, ExpenseCategoryId } from '../../../src/constants';
import { formatAmountInput, parseAmount } from '../../../src/utils/format';
import {
  Screen,
  GlassCard,
  GlassText,
  Input,
  Button,
  OptionPill,
  Avatar,
} from '../../../src/components/ui';

/** Icon per expense category (labels come from i18n `category.<id>`). */
const CATEGORY_ICONS: Record<ExpenseCategoryId, LucideIcon> = {
  food: Utensils,
  coffee: Coffee,
  transport: Car,
  shopping: ShoppingBag,
  others: MoreHorizontal,
};

export default function AddExpenseScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const {
    loading,
    members,
    description,
    setDescription,
    amount,
    setAmount,
    paidBy,
    setPaidBy,
    splitPlayers,
    togglePlayer,
    selectAll,
    deselectAll,
    addExpense,
  } = useAddExpense(id as string);

  const [category, setCategory] = useState<ExpenseCategoryId>(EXPENSE_CATEGORY_IDS[0]);

  return (
    <Screen
      title={t('addExpense.title')}
      showBack
      onBack={() => router.back()}
      keyboardAvoiding
      contentClassName="px-6 pt-4 pb-32"
    >
      <View className="mb-10 items-center">
        <View className="w-full items-center rounded-[40px] border border-surface-line bg-surface-fill px-8 py-6 shadow-lg">
          <GlassText variant="caption" className="mb-2 tracking-[4px]">
            {t('addExpense.amountLabel')}
          </GlassText>
          <View className="w-full border-b border-surface-line pb-4">
            <Input
              variant="amount"
              placeholder="0"
              value={amount}
              onChangeText={(v) => setAmount(formatAmountInput(v))}
              suffix={t('common.vnd')}
              autoFocus
            />
          </View>
        </View>
      </View>

      <GlassCard intensity={30} className="mb-8" padding="p-6">
        <View className="gap-6">
          <Input
            label={t('addExpense.contentLabel')}
            icon={Receipt}
            placeholder={t('addExpense.contentPlaceholder')}
            value={description}
            onChangeText={setDescription}
          />

          <View>
            <GlassText variant="caption" className="mb-3 ml-1">
              {t('addExpense.category')}
            </GlassText>
            <View className="flex-row flex-wrap gap-2">
              {EXPENSE_CATEGORY_IDS.map((catId) => (
                <OptionPill
                  key={catId}
                  label={t(`category.${catId}`)}
                  icon={CATEGORY_ICONS[catId]}
                  selected={category === catId}
                  onPress={() => setCategory(catId)}
                />
              ))}
            </View>
          </View>
        </View>
      </GlassCard>

      <View className="mb-8">
        <GlassText variant="caption" className="mb-4 ml-1">
          {t('addExpense.payer')}
        </GlassText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible">
          <View className="flex-row gap-3">
            {members.map((member) => (
              <OptionPill
                key={member.user_id}
                label={member.full_name?.split(' ')[0]}
                selected={paidBy === member.user_id}
                onPress={() => setPaidBy(member.user_id)}
                showCheck
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <View className="mb-10">
        <View className="mb-4 flex-row items-center justify-between px-1">
          <GlassText variant="caption">{t('addExpense.splitWith')}</GlassText>
          <View className="flex-row gap-4">
            <TouchableOpacity onPress={selectAll}>
              <GlassText className="font-outfit-bold text-xs text-accent">
                {t('addExpense.selectAll')}
              </GlassText>
            </TouchableOpacity>
            <TouchableOpacity onPress={deselectAll}>
              <GlassText className="font-outfit-bold text-xs text-content-muted">
                {t('addExpense.deselectAll')}
              </GlassText>
            </TouchableOpacity>
          </View>
        </View>

        <GlassCard intensity={25} padding="p-2">
          {members.map((member, index) => {
            const isSelected = splitPlayers.includes(member.user_id);
            return (
              <TouchableOpacity
                key={member.user_id}
                onPress={() => togglePlayer(member.user_id)}
                activeOpacity={0.7}
                className={`flex-row items-center p-4 ${
                  index !== members.length - 1 ? 'border-b border-surface-line' : ''
                }`}
              >
                <Avatar name={member.full_name} active={isSelected} className="mr-4" />
                <GlassText
                  className={`flex-1 font-outfit-bold ${isSelected ? 'text-content' : 'text-content-faint'}`}
                >
                  {member.full_name}
                </GlassText>
                <View
                  className={`h-6 w-6 items-center justify-center rounded-lg border ${
                    isSelected ? 'border-accent bg-accent' : 'border-surface-line'
                  }`}
                >
                  {isSelected ? <Check size={14} color={colors.white} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </GlassCard>
      </View>

      <Button
        title={t('addExpense.save')}
        onPress={() => addExpense(category)}
        disabled={loading || parseAmount(amount) <= 0 || splitPlayers.length === 0}
        className="w-full"
      />
    </Screen>
  );
}
