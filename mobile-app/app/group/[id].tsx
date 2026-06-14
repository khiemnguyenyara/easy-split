import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  RefreshControl,
  Clipboard,
  Alert,
  Image,
  Modal,
  Text,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../src/api/supabase';
import { groupService } from '../../src/services/group.service';
import { getGroupBgImage } from '../../src/utils/image';
import {
  formatCurrency,
  formatNumber,
  parseAmount,
  formatAmountInput,
} from '../../src/utils/format';
import { getErrorMessage } from '../../src/utils/error';
import { simplifyDebts } from '../../src/utils/debts';
import {
  Settings,
  Receipt,
  TrendingUp,
  Plus,
  Copy,
  PiggyBank,
  MessageCircle,
  Wallet,
  ShieldCheck,
  Check,
  BarChart3,
  UserPlus,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  Camera,
  Clock,
  X,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useGroupDetails } from '../../src/hooks/useGroupDetails';
import { useThemeColors } from '../../src/theme';
import {
  Screen,
  GlassCard,
  GlassText,
  Button,
  IconButton,
  EmptyState,
  Avatar,
  Loader,
  ProgressBar,
  ExpenseCard,
  Input,
} from '../../src/components/ui';

const TABS = [
  { id: 'expenses', labelKey: 'tabExpenses', icon: Receipt },
  { id: 'settlements', labelKey: 'tabSettlements', icon: TrendingUp },
  { id: 'funds', labelKey: 'tabFunds', icon: PiggyBank },
] as const;

export default function GroupDetailsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'expenses' | 'settlements' | 'funds'>('expenses');
  const [simplifyMode, setSimplifyMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [settling, setSettling] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  // States for custom payment modal
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentCreditorId, setPaymentCreditorId] = useState<string | null>(null);
  const [paymentCreditorName, setPaymentCreditorName] = useState('');
  const [paymentMaxAmount, setPaymentMaxAmount] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState('');

  const {
    group,
    members,
    expenses,
    netBalances,
    rawDebts,
    funds,
    pendingSettlements,
    loading,
    refreshing,
    fetchData,
    onRefresh,
  } = useGroupDetails(id);

  useFocusEffect(
    useCallback(() => {
      fetchData();
      const groupId = Array.isArray(id) ? id[0] : id;
      if (groupId) {
        groupService
          .getGroupChatUnreadCount(groupId)
          .then(setChatUnread)
          .catch(() => setChatUnread(0));
      }
    }, [fetchData, id])
  );

  // Live-bump the chat badge when another member sends a message while this
  // screen is open (focus recompute only runs on (re)entry). Requires Realtime
  // to be enabled for `messages` (migration 20260322000000).
  useEffect(() => {
    const groupId = Array.isArray(id) ? id[0] : id;
    if (!groupId || !user?.id) return;
    const channel = supabase
      .channel(`group_badge:${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const senderId = (payload.new as { sender_id?: string }).sender_id;
          if (senderId && senderId !== user.id) setChatUnread((c) => c + 1);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user?.id]);

  const copyInviteCode = () => {
    if (group?.invite_code) {
      Clipboard.setString(group.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const saveBudget = async (value?: string) => {
    const groupId = Array.isArray(id) ? id[0] : id;
    const parsed = value ? parseAmount(value) : 0;
    try {
      const { error } = await supabase
        .from('groups')
        .update({ budget_amount: parsed > 0 ? parsed : null })
        .eq('group_id', groupId);
      if (error) throw error;
      fetchData();
    } catch (error) {
      Alert.alert(t('common.error'), getErrorMessage(error) || t('common.somethingWrong'));
    }
  };

  const promptSetBudget = () =>
    Alert.prompt(
      t('groupDetail.setBudget'),
      t('groupDetail.budgetPrompt'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.save'), onPress: saveBudget },
      ],
      'plain-text',
      group?.budget_amount ? String(group.budget_amount) : '',
      'numeric'
    );

  // Debtor uploads a payment proof → creates a pending settlement to the creditor.
  const handlePayDebt = async (creditorId: string, amount: number) => {
    if (!user?.id) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('common.permissionDenied'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    if (result.canceled || !result.assets?.length || !result.assets[0].base64) return;

    setSettling(true);
    try {
      const groupId = Array.isArray(id) ? id[0] : id;
      const fileExt = result.assets[0].uri.split('.').pop();
      const filePath = `settlements/${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, decode(result.assets[0].base64), { contentType: `image/${fileExt}` });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('attachments').getPublicUrl(filePath);

      const { error } = await supabase.from('debt_settlements').insert({
        group_id: groupId,
        debtor_id: user.id,
        creditor_id: creditorId,
        amount,
        status: 'pending',
        proof_image_url: publicUrl,
      });
      if (error) throw error;
      Alert.alert(t('common.success'), t('settlement.proofUploaded'));
      fetchData();
    } catch (error) {
      Alert.alert(t('common.error'), getErrorMessage(error) || t('common.somethingWrong'));
    } finally {
      setSettling(false);
    }
  };

  const submitCustomPayment = async () => {
    const parsedAmount = parseAmount(paymentAmount);
    if (parsedAmount <= 0) {
      Alert.alert(t('common.error'), t('addExpense.errInvalidAmount'));
      return;
    }
    if (parsedAmount > paymentMaxAmount) {
      Alert.alert(t('common.error'), t('groupDetail.errAmountExceedsDebt'));
      return;
    }

    setPaymentModalVisible(false);
    if (paymentCreditorId) {
      await handlePayDebt(paymentCreditorId, parsedAmount);
    }
  };

  // Creditor confirms they received the money → settlement becomes confirmed.
  const handleConfirmDebt = async (settlementId: string) => {
    setSettling(true);
    try {
      const { data, error } = await supabase
        .from('debt_settlements')
        .update({ status: 'confirmed' })
        .eq('settlement_id', settlementId)
        .select('settlement_id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error(t('settlement.confirmDenied'));
      Alert.alert(t('common.success'), t('settlement.confirmedPay'));
      fetchData();
    } catch (error) {
      Alert.alert(t('common.error'), getErrorMessage(error) || t('common.somethingWrong'));
    } finally {
      setSettling(false);
    }
  };

  if (loading) return <Loader fullscreen />;

  if (!group) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-6">
        <GlassText variant="body" className="mb-6 text-content-muted">
          {t('groupDetail.notFound')}
        </GlassText>
        <Button title={t('common.goBack')} onPress={() => router.back()} className="w-40" />
      </SafeAreaView>
    );
  }

  const totalGroupExpense = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const budgetAmount = Number(group.budget_amount ?? 0);
  const budgetProgress = budgetAmount > 0 ? totalGroupExpense / budgetAmount : 0;

  // Personalized "who pays whom" for the current user.
  // Default: raw pairwise debts (A→B, B→C kept separate). Opt-in: simplified netting.
  const activeDebts = simplifyMode ? simplifyDebts(netBalances) : rawDebts;
  const myDebts = activeDebts.filter((d) => d.from_id === user?.id);
  const myCredits = activeDebts.filter((d) => d.to_id === user?.id);

  return (
    <Screen
      title={group.group_name}
      showBack
      headerRight={
        <View className="flex-row items-center gap-2">
          <IconButton icon={BarChart3} onPress={() => router.push(`/group/${id}/stats`)} />
          <View>
            <IconButton icon={MessageCircle} onPress={() => router.push(`/group/${id}/chat`)} />
            {chatUnread > 0 ? (
              <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full border border-surface-glass bg-accent px-1">
                <Text
                  className="font-outfit-bold text-[10px] text-white text-center leading-none"
                  style={{ includeFontPadding: false, textAlignVertical: 'center' }}
                >
                  {chatUnread > 9 ? '9+' : chatUnread}
                </Text>
              </View>
            ) : null}
          </View>
          <IconButton icon={UserPlus} onPress={() => router.push(`/group/${id}/add-member`)} />
          <IconButton icon={Settings} onPress={() => router.push(`/group/${id}/members`)} />
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      overlay={
        <View className="absolute bottom-12 right-6">
          <IconButton
            icon={Plus}
            variant="fab"
            iconSize={32}
            onPress={() => router.push(`/group/${id}/add-expense`)}
          />
        </View>
      }
    >
      <GlassCard intensity={45} className="mb-8" backgroundImageUri={getGroupBgImage(id as string)}>
        <View className="mb-6 flex-row items-start justify-between">
          <View>
            <GlassText variant="caption" className="mb-2">
              {t('groupDetail.totalGroupExpense')}
            </GlassText>
            <GlassText className="font-outfit-bold text-4xl">
              {formatCurrency(totalGroupExpense)}
            </GlassText>
          </View>
          <View className="rounded-2xl border border-accent/30 bg-accent/20 p-4">
            <Wallet size={24} color={colors.accent} />
          </View>
        </View>

        {budgetAmount > 0 ? (
          <TouchableOpacity activeOpacity={0.7} onPress={promptSetBudget} className="mb-6">
            <View className="mb-1.5 flex-row items-center justify-between">
              <GlassText variant="caption" className="text-[10px]">
                {t('groupDetail.budget')}
              </GlassText>
              <GlassText className="font-outfit-bold text-[10px] text-content-muted">
                {formatCurrency(totalGroupExpense)} / {formatCurrency(budgetAmount)}
              </GlassText>
            </View>
            <ProgressBar
              progress={budgetProgress}
              tone={budgetProgress >= 1 ? 'danger' : 'accent'}
              className="h-2"
            />
            {budgetProgress >= 1 ? (
              <GlassText className="mt-1.5 font-outfit-bold text-[10px] text-danger">
                {t('groupDetail.budgetExceeded')}
              </GlassText>
            ) : null}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={promptSetBudget}
            className="mb-6 flex-row items-center justify-between rounded-2xl border border-dashed border-surface-line bg-surface-fill px-4 py-3"
          >
            <View className="flex-row items-center">
              <Wallet size={14} color={colors.contentFaint} />
              <GlassText variant="caption" className="ml-2 normal-case">
                {t('groupDetail.setBudget')}
              </GlassText>
            </View>
            <Plus size={16} color={colors.contentFaint} />
          </TouchableOpacity>
        )}

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-3 flex-row">
              {members.slice(0, members.length > 3 ? 2 : 3).map((m, i) => (
                <Avatar
                  key={m.user_id}
                  name={m.full_name}
                  size="sm"
                  style={{
                    position: 'relative',
                    marginLeft: i === 0 ? 0 : -16,
                    zIndex: i + 1,
                  }}
                />
              ))}
              {members.length > 3 ? (
                <View
                  style={{
                    position: 'relative',
                    marginLeft: -16,
                    zIndex: 3,
                  }}
                  className="h-8 w-8 items-center justify-center rounded-full border border-surface-line bg-white dark:bg-[#201D47]"
                >
                  <GlassText className="font-outfit-bold text-[9px]">
                    +{members.length - 2}
                  </GlassText>
                </View>
              ) : null}
            </View>
            <GlassText variant="caption" className="text-[10px]">
              {t('common.memberCount', { count: members.length })}
            </GlassText>
          </View>

          <TouchableOpacity
            onPress={copyInviteCode}
            className={`flex-row items-center rounded-lg border px-3 py-1.5 ${
              copied ? 'border-success/30 bg-success/20' : 'border-surface-line bg-surface-fill'
            }`}
          >
            <GlassText
              className={`mr-1.5 font-outfit-bold text-[9px] uppercase tracking-tight ${
                copied ? 'text-success' : 'text-content-muted'
              }`}
            >
              {copied ? t('groupDetail.copied') : group.invite_code}
            </GlassText>
            {copied ? (
              <Check size={10} color={colors.success} />
            ) : (
              <Copy size={10} color={colors.content} />
            )}
          </TouchableOpacity>
        </View>
      </GlassCard>

      <View className="mb-8 flex-row rounded-2xl border border-surface-line bg-surface-fill p-1">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              className={`flex-1 flex-row items-center justify-center rounded-xl py-3 ${
                active ? 'border border-surface-line bg-surface-glass' : ''
              }`}
            >
              <tab.icon size={16} color={active ? colors.content : colors.contentFaint} />
              <GlassText
                className={`ml-2 font-outfit-bold text-[11px] uppercase tracking-tight ${
                  active ? 'text-content' : 'text-content-faint'
                }`}
              >
                {t(`groupDetail.${tab.labelKey}`)}
              </GlassText>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'expenses' ? (
        <View>
          <GlassText variant="h3" className="mb-6">
            {t('groupDetail.transactionHistory')}
          </GlassText>
          {expenses.length === 0 ? (
            <EmptyState icon={Receipt} title={t('groupDetail.noExpenses')} />
          ) : (
            expenses.map((expense) => <ExpenseCard key={expense.expense_id} expense={expense} />)
          )}
        </View>
      ) : null}

      {activeTab === 'settlements' ? (
        <View>
          <View className="mb-5">
            <View className="flex-row rounded-2xl border border-surface-line bg-surface-fill p-1">
              <TouchableOpacity
                onPress={() => setSimplifyMode(false)}
                className={`flex-1 items-center rounded-xl py-2.5 ${
                  !simplifyMode ? 'border border-surface-line bg-surface-glass' : ''
                }`}
              >
                <GlassText
                  className={`font-outfit-bold text-[11px] uppercase tracking-tight ${
                    !simplifyMode ? 'text-content' : 'text-content-faint'
                  }`}
                >
                  {t('groupDetail.debtDetailed')}
                </GlassText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSimplifyMode(true)}
                className={`flex-1 items-center rounded-xl py-2.5 ${
                  simplifyMode ? 'border border-surface-line bg-surface-glass' : ''
                }`}
              >
                <GlassText
                  className={`font-outfit-bold text-[11px] uppercase tracking-tight ${
                    simplifyMode ? 'text-content' : 'text-content-faint'
                  }`}
                >
                  {t('groupDetail.debtSimplified')}
                </GlassText>
              </TouchableOpacity>
            </View>
            <GlassText
              variant="caption"
              className="ml-1 mt-2 normal-case text-[10px] leading-4 text-content-faint"
            >
              {simplifyMode
                ? t('groupDetail.debtSimplifiedHint')
                : t('groupDetail.debtDetailedHint')}
            </GlassText>
          </View>
          {myDebts.length === 0 && myCredits.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title={t('groupDetail.allSettled')}
              description={t('groupDetail.allSettledDesc')}
            />
          ) : (
            <>
              {myDebts.length > 0 ? (
                <>
                  <GlassText variant="caption" className="mb-3 ml-1 tracking-widest">
                    {t('groupDetail.youPay')}
                  </GlassText>
                  {myDebts.map((d) => {
                    const pending = pendingSettlements.find(
                      (s) => s.debtor_id === user?.id && s.creditor_id === d.to_id
                    );
                    return (
                      <GlassCard key={d.to_id} intensity={20} className="mb-3" padding="p-4">
                        <View className="flex-row items-center">
                          <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl border border-danger/20 bg-danger/10">
                            <ArrowUpRight size={18} color={colors.danger} />
                          </View>
                          <View className="flex-1">
                            <GlassText variant="caption" className="text-[10px]">
                              {t('groupDetail.payTo')}
                            </GlassText>
                            <GlassText className="font-outfit-bold text-base" numberOfLines={1}>
                              {d.to_name}
                            </GlassText>
                          </View>
                          <GlassText variant="h3" className="text-lg text-danger">
                            {formatCurrency(d.amount)}
                          </GlassText>
                        </View>
                        {pending ? (
                          <View className="mt-3 flex-col gap-2">
                            <View className="flex-row items-center justify-center rounded-2xl bg-surface-fill py-2.5">
                              <Clock size={14} color={colors.accent} />
                              <GlassText className="ml-2 font-outfit-bold text-xs text-content-muted">
                                {t('settlement.pendingConfirm')}
                              </GlassText>
                            </View>
                            {pending.amount < d.amount ? (
                              <GlassText className="text-center font-outfit-medium text-[10px] text-accent">
                                {t('groupDetail.partialPayNoteOwe', {
                                  paid: formatCurrency(pending.amount),
                                  remaining: formatCurrency(d.amount - pending.amount),
                                })}
                              </GlassText>
                            ) : null}
                          </View>
                        ) : (
                          <TouchableOpacity
                            disabled={settling}
                            onPress={() => {
                              setPaymentCreditorId(d.to_id);
                              setPaymentCreditorName(d.to_name);
                              setPaymentMaxAmount(d.amount);
                              setPaymentAmount(formatNumber(d.amount));
                              setPaymentModalVisible(true);
                            }}
                            className="mt-3 flex-row items-center justify-center rounded-2xl bg-content py-2.5"
                          >
                            <Camera size={16} color={colors.white} />
                            <GlassText className="ml-2 font-outfit-bold text-xs text-white">
                              {t('groupDetail.payDebt')}
                            </GlassText>
                          </TouchableOpacity>
                        )}
                      </GlassCard>
                    );
                  })}
                </>
              ) : null}

              {myCredits.length > 0 ? (
                <>
                  <GlassText variant="caption" className="mb-3 ml-1 mt-4 tracking-widest">
                    {t('groupDetail.youReceive')}
                  </GlassText>
                  {myCredits.map((d) => {
                    const pending = pendingSettlements.find(
                      (s) => s.debtor_id === d.from_id && s.creditor_id === user?.id
                    );
                    return (
                      <GlassCard key={d.from_id} intensity={20} className="mb-3" padding="p-4">
                        <View className="flex-row items-center">
                          <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl border border-success/20 bg-success/10">
                            <ArrowDownLeft size={18} color={colors.success} />
                          </View>
                          <View className="flex-1">
                            <GlassText variant="caption" className="text-[10px]">
                              {t('groupDetail.receiveFrom')}
                            </GlassText>
                            <GlassText className="font-outfit-bold text-base" numberOfLines={1}>
                              {d.from_name}
                            </GlassText>
                          </View>
                          <GlassText variant="h3" className="text-lg text-success">
                            {formatCurrency(d.amount)}
                          </GlassText>
                        </View>
                        {pending ? (
                          <View className="mt-3 flex-col gap-2">
                            {pending.amount < d.amount ? (
                              <GlassText className="text-center font-outfit-medium text-[10px] text-success">
                                {t('groupDetail.partialPayNote', {
                                  paid: formatCurrency(pending.amount),
                                  remaining: formatCurrency(d.amount - pending.amount),
                                })}
                              </GlassText>
                            ) : null}
                            <View className="flex-row items-center gap-2">
                              {pending.proof_image_url ? (
                                <TouchableOpacity
                                  onPress={() => setProofUrl(pending.proof_image_url)}
                                  className="h-11 w-11 items-center justify-center rounded-2xl border border-surface-line bg-surface-fill"
                                >
                                  <Eye size={18} color={colors.content} />
                                </TouchableOpacity>
                              ) : null}
                              <TouchableOpacity
                                disabled={settling}
                                onPress={() => handleConfirmDebt(pending.settlement_id)}
                                className="flex-1 flex-row items-center justify-center rounded-2xl bg-success py-2.5"
                              >
                                <Check size={16} color={colors.white} />
                                <GlassText className="ml-2 font-outfit-bold text-xs text-white">
                                  {t('groupDetail.confirmPaid')}
                                </GlassText>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <View className="mt-3 flex-row items-center justify-center rounded-2xl bg-surface-fill py-2.5">
                            <Clock size={14} color={colors.contentFaint} />
                            <GlassText className="ml-2 font-outfit-medium text-xs text-content-faint">
                              {t('groupDetail.notPaidYet')}
                            </GlassText>
                          </View>
                        )}
                      </GlassCard>
                    );
                  })}
                </>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {activeTab === 'funds' ? (
        <View>
          <GlassText variant="h3" className="mb-6">
            {t('groupDetail.groupFund')}
          </GlassText>

          {funds.length === 0 ? (
            <GlassCard intensity={25} className="items-center" padding="p-8">
              <View className="mb-5 h-20 w-20 items-center justify-center rounded-[28px] border border-accent/20 bg-accent/10">
                <PiggyBank size={40} color={colors.accent} />
              </View>
              <GlassText variant="caption" className="mb-6 px-4 text-center normal-case leading-5">
                {t('groupDetail.fundSectionDesc')}
              </GlassText>
              <Button
                title={t('groupDetail.openFunds')}
                onPress={() => router.push(`/group/${id}/fund-management`)}
                className="w-full"
              />
            </GlassCard>
          ) : (
            <View>
              {funds.slice(0, 2).map((fund) => {
                const current = Number(fund.current_amount ?? 0);
                const target = Number(fund.target_amount ?? 0);
                const progress = target ? current / target : 0;
                return (
                  <GlassCard key={fund.funding_id} intensity={25} className="mb-4" padding="p-5">
                    <View className="mb-3 flex-row items-center justify-between">
                      <View className="mr-3 flex-1 flex-row items-center">
                        <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl border border-surface-line bg-surface-fill">
                          <PiggyBank size={16} color={colors.accent} />
                        </View>
                        <GlassText className="flex-1 font-outfit-bold" numberOfLines={1}>
                          {fund.name}
                        </GlassText>
                      </View>
                      <GlassText className="font-outfit-bold text-xs text-content-muted">
                        {Math.round(progress * 100)}%
                      </GlassText>
                    </View>
                    <ProgressBar progress={progress} tone="success" className="mb-2 h-2" />
                    <View className="flex-row justify-between">
                      <GlassText className="font-outfit-bold text-xs text-success">
                        {formatCurrency(current)}
                      </GlassText>
                      <GlassText variant="caption" className="text-[10px]">
                        {t('fund.target', { amount: formatNumber(target) })}
                      </GlassText>
                    </View>
                  </GlassCard>
                );
              })}
              <Button
                title={t('groupDetail.openFunds')}
                variant="secondary"
                onPress={() => router.push(`/group/${id}/fund-management`)}
                className="mt-2 w-full"
              />
            </View>
          )}
        </View>
      ) : null}

      {/* Proof image viewer */}
      <Modal
        visible={!!proofUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setProofUrl(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setProofUrl(null)}
          className="flex-1 items-center justify-center bg-black/90 px-6"
        >
          {proofUrl ? (
            <Image source={{ uri: proofUrl }} className="h-3/4 w-full" resizeMode="contain" />
          ) : null}
          <TouchableOpacity
            onPress={() => setProofUrl(null)}
            className="absolute right-6 top-16 h-10 w-10 items-center justify-center rounded-full bg-white/20"
          >
            <X size={20} color={colors.white} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Custom Payment Amount & Proof Modal */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <GlassCard intensity={40} className="w-full border-surface-line" padding="p-6">
            <View className="mb-4 flex-row items-center justify-between">
              <GlassText variant="h3">{t('groupDetail.payDebt')}</GlassText>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <X size={20} color={colors.contentMuted} />
              </TouchableOpacity>
            </View>

            <GlassText variant="body" className="mb-4 text-content-muted">
              {t('groupDetail.payTo')}:{' '}
              <GlassText className="font-outfit-bold text-content">{paymentCreditorName}</GlassText>
            </GlassText>

            <Input
              label={t('groupDetail.payDebtAmount')}
              placeholder="0"
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={(v) => setPaymentAmount(formatAmountInput(v))}
              trailing={
                <View className="rounded-md border border-surface-line bg-surface-fill px-2 py-1">
                  <GlassText className="font-outfit-bold text-[10px] text-content-muted">
                    {t('common.vnd')}
                  </GlassText>
                </View>
              }
              containerClassName="mb-6"
            />

            <View className="flex-row gap-4">
              <Button
                title={t('common.cancel')}
                variant="secondary"
                onPress={() => setPaymentModalVisible(false)}
                className="flex-1"
              />
              <Button
                title={t('groupDetail.chooseProofAndPay')}
                onPress={submitCustomPayment}
                className="flex-[2]"
              />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </Screen>
  );
}
