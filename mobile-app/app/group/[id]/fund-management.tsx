import React, { useState, useCallback } from 'react';
import { View, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus, PiggyBank, Target, CheckCircle2, Check, Clock } from 'lucide-react-native';
import { supabase } from '../../../src/api/supabase';
import { useAuthStore } from '../../../src/store/useAuthStore';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useThemeColors } from '../../../src/theme';
import { formatNumber, formatAmountInput, parseAmount } from '../../../src/utils/format';
import { getErrorMessage } from '../../../src/utils/error';
import type { Fund, FundContribution } from '../../../src/types/models';
import {
  Screen,
  GlassCard,
  GlassText,
  Input,
  Button,
  ListItem,
  EmptyState,
  Badge,
  Avatar,
  ProgressBar,
  Loader,
} from '../../../src/components/ui';

const VndChip = () => (
  <View className="rounded-md border border-surface-line bg-surface-fill px-2.5 py-1">
    <GlassText className="font-outfit-bold text-[10px] text-content-muted">VNĐ</GlassText>
  </View>
);

export default function FundManagementScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [contributions, setContributions] = useState<FundContribution[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [fundName, setFundName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const groupId = Array.isArray(id) ? id[0] : id;
      if (!groupId) return;

      // Who can confirm contributions: the group creator (admin).
      const { data: groupData } = await supabase
        .from('groups')
        .select('created_by')
        .eq('group_id', groupId)
        .single();
      setIsAdmin(!!groupData && groupData.created_by === user?.id);

      const { data: fundsData, error: fundsError } = await supabase
        .from('fundings')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (fundsError) throw fundsError;
      setFunds(fundsData || []);

      const fundIds = fundsData?.map((f) => f.funding_id) || [];
      if (fundIds.length > 0) {
        const { data: contribs, error: contribsError } = await supabase
          .from('fund_contributions')
          .select('*, profiles(full_name)')
          .in('funding_id', fundIds)
          .order('created_at', { ascending: false });

        if (contribsError) throw contribsError;
        setContributions((contribs ?? []) as unknown as FundContribution[]);
      } else {
        setContributions([]);
      }
    } catch (error) {
      console.error('Error fetching funds:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, user?.id]);

  // Refetch every time the screen gains focus so a freshly created fund (or a
  // new contribution) always shows when navigating back into the screen.
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCreateFund = async () => {
    if (!fundName.trim() || !targetAmount) {
      Alert.alert(t('common.error'), t('fund.errMissing'));
      return;
    }

    setSubmitting(true);
    try {
      const groupId = Array.isArray(id) ? id[0] : id;
      const { error } = await supabase.from('fundings').insert({
        group_id: groupId,
        name: fundName.trim(),
        target_amount: parseAmount(targetAmount),
        status: 'active',
      });

      if (error) throw error;
      Alert.alert(t('common.success'), t('fund.created'));
      setIsCreating(false);
      setFundName('');
      setTargetAmount('');
      fetchData();
    } catch (error) {
      Alert.alert(t('common.error'), getErrorMessage(error) || t('common.somethingWrong'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleContribute = async (fundingId: string, amount: string) => {
    if (parseAmount(amount) <= 0) {
      Alert.alert(t('common.error'), t('fund.errNoAmount'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (result.canceled || !result.assets?.length || !result.assets[0].base64) return;

    setSubmitting(true);
    try {
      if (!user?.id) throw new Error('User not found');
      const fileExt = result.assets[0].uri.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `funds/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, decode(result.assets[0].base64), { contentType: `image/${fileExt}` });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('attachments').getPublicUrl(filePath);

      const { error } = await supabase.from('fund_contributions').insert({
        funding_id: fundingId,
        user_id: user.id,
        amount: parseAmount(amount),
        proof_img: publicUrl,
        status: 'pending',
      });

      if (error) throw error;
      Alert.alert(t('common.success'), t('fund.contributed'));
      fetchData();
    } catch (error) {
      Alert.alert(t('common.error'), getErrorMessage(error) || t('common.somethingWrong'));
    } finally {
      setSubmitting(false);
    }
  };

  const promptContribute = (fundingId: string) =>
    Alert.prompt(
      t('fund.promptTitle'),
      t('fund.promptMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('fund.contribute'),
          onPress: (val?: string) => handleContribute(fundingId, val || '0'),
        },
      ],
      'plain-text',
      '',
      'numeric'
    );

  // Admin confirms a pending contribution → mark confirmed and sync the fund's
  // current_amount to the sum of all confirmed contributions.
  const confirmContribution = async (contrib: FundContribution, fundingId: string) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('fund_contributions')
        .update({ status: 'confirmed' })
        .eq('contribution_id', contrib.contribution_id);
      if (error) throw error;

      const newConfirmedTotal = contributions
        .filter(
          (c) =>
            c.funding_id === fundingId &&
            (c.status === 'confirmed' || c.contribution_id === contrib.contribution_id)
        )
        .reduce((sum, c) => sum + Number(c.amount), 0);

      await supabase
        .from('fundings')
        .update({ current_amount: newConfirmedTotal })
        .eq('funding_id', fundingId);

      Alert.alert(t('common.success'), t('fund.confirmedContribution'));
      fetchData();
    } catch (error) {
      Alert.alert(t('common.error'), getErrorMessage(error) || t('common.somethingWrong'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader fullscreen />;

  return (
    <Screen
      title={t('fund.title')}
      showBack
      contentClassName="px-6 pt-4 pb-32"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      {isCreating ? (
        <GlassCard intensity={30} className="mb-8" padding="p-6">
          <GlassText variant="h3" className="mb-6">
            {t('fund.createTitle')}
          </GlassText>

          <View className="mb-6 gap-6">
            <Input
              label={t('fund.nameLabel')}
              placeholder={t('fund.namePlaceholder')}
              value={fundName}
              onChangeText={setFundName}
            />
            <Input
              label={t('fund.targetLabel')}
              placeholder={t('fund.targetPlaceholder')}
              keyboardType="numeric"
              value={targetAmount}
              onChangeText={(v) => setTargetAmount(formatAmountInput(v))}
              trailing={<VndChip />}
            />
          </View>

          <View className="flex-row gap-4">
            <Button
              title={t('common.cancel')}
              variant="secondary"
              onPress={() => setIsCreating(false)}
              className="flex-1"
            />
            <Button
              title={t('fund.create')}
              onPress={handleCreateFund}
              loading={submitting}
              className="flex-[2]"
            />
          </View>
        </GlassCard>
      ) : (
        <ListItem
          title={t('fund.createTitle')}
          subtitle={t('fund.createSubtitle')}
          onPress={() => setIsCreating(true)}
          className="mb-8"
          leading={
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl bg-content shadow-sm">
              <Plus size={24} color={colors.white} />
            </View>
          }
        />
      )}

      <GlassText variant="caption" className="mb-4 ml-1 tracking-widest">
        {t('fund.existing')}
      </GlassText>

      {funds.length === 0 ? (
        <EmptyState icon={PiggyBank} title={t('fund.empty')} />
      ) : (
        funds.map((fund) => {
          const fundContribs = contributions.filter((c) => c.funding_id === fund.funding_id);
          const currentAmount = fundContribs
            .filter((c) => c.status === 'confirmed')
            .reduce((sum, c) => sum + Number(c.amount), 0);
          const progress = fund.target_amount ? currentAmount / fund.target_amount : 0;

          return (
            <GlassCard key={fund.funding_id} intensity={25} className="mb-6" padding="p-6">
              <View className="mb-4 flex-row items-start justify-between">
                <View className="flex-1">
                  <GlassText className="mb-0.5 font-outfit-bold text-lg">{fund.name}</GlassText>
                  <View className="flex-row items-center">
                    <Target size={12} color={colors.contentFaint} />
                    <GlassText variant="caption" className="ml-1 text-[10px]">
                      {t('fund.target', { amount: formatNumber(Number(fund.target_amount)) })}
                    </GlassText>
                  </View>
                </View>
                <Badge label={fund.status ?? ''} tone="success" />
              </View>

              <ProgressBar progress={progress} tone="success" className="mb-2 h-2.5" />
              <View className="mb-6 flex-row justify-between">
                <GlassText className="font-outfit-bold text-xs text-success">
                  {formatNumber(currentAmount)}đ
                </GlassText>
                <GlassText className="font-outfit-bold text-xs text-content-muted">
                  {Math.round(progress * 100)}%
                </GlassText>
              </View>

              {/* Contributions list with admin confirm controls */}
              <GlassText variant="caption" className="mb-3 ml-1 text-[10px] tracking-widest">
                {t('fund.contributions')}
              </GlassText>
              {fundContribs.length === 0 ? (
                <GlassText variant="caption" className="mb-6 ml-1 normal-case opacity-60">
                  {t('fund.noContribs')}
                </GlassText>
              ) : (
                <View className="mb-6 gap-2">
                  {fundContribs.map((c) => {
                    const confirmed = c.status === 'confirmed';
                    return (
                      <View
                        key={c.contribution_id}
                        className="flex-row items-center rounded-2xl border border-surface-line bg-surface-fill p-3"
                      >
                        <Avatar name={c.profiles?.full_name} size="sm" className="mr-3" />
                        <View className="flex-1">
                          <GlassText className="font-outfit-medium text-sm" numberOfLines={1}>
                            {c.profiles?.full_name || t('common.user')}
                          </GlassText>
                          <GlassText variant="caption" className="text-[10px]">
                            {formatNumber(Number(c.amount))}đ
                          </GlassText>
                        </View>

                        {confirmed ? (
                          <View className="flex-row items-center rounded-full border border-success/20 bg-success/10 px-2.5 py-1">
                            <Check size={12} color={colors.success} />
                            <GlassText className="ml-1 font-outfit-bold text-[9px] uppercase tracking-tight text-success">
                              {t('fund.confirmed')}
                            </GlassText>
                          </View>
                        ) : isAdmin ? (
                          <TouchableOpacity
                            disabled={submitting}
                            onPress={() => confirmContribution(c, fund.funding_id)}
                            className="rounded-xl bg-content px-4 py-2"
                          >
                            <GlassText className="font-outfit-bold text-xs text-white">
                              {t('fund.confirm')}
                            </GlassText>
                          </TouchableOpacity>
                        ) : (
                          <View className="flex-row items-center rounded-full border border-surface-line px-2.5 py-1">
                            <Clock size={12} color={colors.contentFaint} />
                            <GlassText className="ml-1 font-outfit-bold text-[9px] uppercase tracking-tight text-content-muted">
                              {t('fund.pending')}
                            </GlassText>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              <Button
                title={t('fund.deposit')}
                icon={CheckCircle2}
                onPress={() => promptContribute(fund.funding_id)}
                className="w-full"
              />
            </GlassCard>
          );
        })
      )}
    </Screen>
  );
}
