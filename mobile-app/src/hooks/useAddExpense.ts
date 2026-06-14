import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import i18n from '../i18n';
import { supabase } from '../api/supabase';
import { useRouter } from 'expo-router';
import { DEFAULT_EXPENSE_CATEGORY } from '../constants';
import { getErrorMessage } from '../utils/error';
import { parseAmount } from '../utils/format';

export interface ExpenseMember {
  user_id: string;
  full_name: string;
}

export const useAddExpense = (groupId: string) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<ExpenseMember[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitPlayers, setSplitPlayers] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('group_members')
          .select(
            `
            user_id,
            profiles:profiles (
              full_name
            )
          `
          )
          .eq('group_id', groupId);

        if (cancelled) return;
        if (error) throw error;

        const formattedMembers: ExpenseMember[] = (data ?? []).map((m) => {
          const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          return {
            user_id: m.user_id,
            full_name: profile?.full_name || i18n.t('common.user'),
          };
        });

        setMembers(formattedMembers);
        if (formattedMembers.length > 0) {
          setPaidBy(formattedMembers[0].user_id);
          setSplitPlayers(formattedMembers.map((m) => m.user_id));
        }
      } catch (error) {
        if (!cancelled) console.error('Error fetching members:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const togglePlayer = (userId: string) => {
    setSplitPlayers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectAll = () => setSplitPlayers(members.map((m) => m.user_id));
  const deselectAll = () => setSplitPlayers([]);

  const addExpense = async (category: string = DEFAULT_EXPENSE_CATEGORY) => {
    if (!description || !amount || !paidBy || splitPlayers.length === 0) {
      Alert.alert(i18n.t('common.error'), i18n.t('addExpense.errIncomplete'));
      return;
    }

    const amountValue = parseAmount(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert(i18n.t('common.error'), i18n.t('addExpense.errInvalidAmount'));
      return;
    }

    setLoading(true);

    try {
      // 1. Create expense
      const { data: expense, error: expError } = await supabase
        .from('expenses')
        .insert([
          {
            group_id: groupId,
            amount: amountValue,
            description,
            payer_id: paidBy,
            category,
          },
        ])
        .select()
        .single();

      if (expError) throw expError;

      // 2. Create splits — distribute integer đồng exactly (largest-remainder):
      // the leftover after an uneven division is handed out one đồng at a time,
      // so the shares always sum back to the expense amount (no rounding leak).
      const n = splitPlayers.length;
      const base = Math.floor(amountValue / n);
      let remainder = amountValue - base * n;
      const splits = splitPlayers.map((userId) => ({
        expense_id: expense.expense_id,
        user_id: userId,
        share_amount: base + (remainder-- > 0 ? 1 : 0),
      }));

      const { error: splitError } = await supabase.from('expense_splits').insert(splits);

      if (splitError) throw splitError;

      Alert.alert(i18n.t('common.success'), i18n.t('addExpense.success'));
      router.back();
    } catch (error) {
      console.error('Error adding expense:', error);
      Alert.alert(i18n.t('common.error'), getErrorMessage(error) || i18n.t('addExpense.errFailed'));
    } finally {
      setLoading(false);
    }
  };

  return {
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
  };
};
