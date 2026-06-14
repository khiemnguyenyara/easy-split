import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Users, FileText, Copy, Check, Wallet, Search, UserPlus } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useCreateGroup } from '../src/hooks/useCreateGroup';
import { useAddMember } from '../src/hooks/useAddMember';
import { useThemeColors } from '../src/theme';
import { formatAmountInput } from '../src/utils/format';
import {
  GlassCard,
  GlassText,
  GlassHeader,
  Input,
  Button,
  Avatar,
  Loader,
} from '../src/components/ui';

export default function CreateGroupScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [copied, setCopied] = useState(false);

  const { createGroup, loading, inviteCode, groupId } = useCreateGroup();
  const { query, results, searching, addingId, search, addMember, suggestions, fetchSuggestions } = useAddMember(groupId || '');

  const handleCreateGroup = async () => {
    await createGroup(groupName, description, budgetAmount);
  };

  const copyToClipboard = async () => {
    if (inviteCode) {
      await Clipboard.setStringAsync(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderMemberResults = () => {
    const trimmed = query.trim();
    if (searching) {
      return (
        <View className="py-4 items-center justify-center">
          <Loader size="small" />
        </View>
      );
    }

    if (trimmed.length < 2) {
      return null;
    }

    if (results.length === 0) {
      return (
        <View className="py-4 items-center justify-center">
          <GlassText variant="caption" className="text-content-faint text-center">
            {t('addMember.emptyTitle')}
          </GlassText>
        </View>
      );
    }

    return (
      <View className="gap-2 mt-2">
        {results.map((item) => {
          const adding = addingId === item.user_id;
          return (
            <View
              key={item.user_id}
              className={`flex-row items-center rounded-2xl border border-surface-line bg-surface-fill p-3 ${
                item.is_member ? 'opacity-60' : ''
              }`}
            >
              <Avatar name={item.full_name} size="md" className="mr-3" />
              <View className="flex-1">
                <GlassText className="font-outfit-bold text-sm" numberOfLines={1}>
                  {item.full_name}
                </GlassText>
                <GlassText
                  variant="caption"
                  className="normal-case text-[11px] text-content-muted"
                  numberOfLines={1}
                >
                  {item.email}
                </GlassText>
              </View>
              {item.is_member ? (
                <View className="flex-row items-center rounded-lg border border-success/30 bg-success/10 px-2 py-1">
                  <Check size={11} color={colors.success} />
                  <GlassText className="ml-1 text-[10px] text-success">
                    {t('addMember.alreadyMember')}
                  </GlassText>
                </View>
              ) : (
                <TouchableOpacity
                  disabled={adding}
                  onPress={() => addMember(item)}
                  className="h-8 w-8 items-center justify-center rounded-lg border border-accent/30 bg-accent/15"
                >
                  {adding ? <Loader size="small" /> : <UserPlus size={14} color={colors.accent} />}
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderMemberSuggestions = () => {
    if (query.trim().length >= 2 || suggestions.length === 0) {
      return null;
    }

    return (
      <View className="mb-4">
        <GlassText variant="caption" className="mb-2 tracking-widest text-[10px] text-content-muted uppercase">
          {t('addMember.suggestions')}
        </GlassText>
        <View className="gap-2">
          {suggestions.map((item) => {
            const adding = addingId === item.user_id;
            return (
              <View
                key={item.user_id}
                className="flex-row items-center rounded-2xl border border-surface-line bg-surface-fill p-3"
              >
                <Avatar name={item.full_name} size="md" className="mr-3" />
                <View className="flex-1">
                  <GlassText className="font-outfit-bold text-sm" numberOfLines={1}>
                    {item.full_name}
                  </GlassText>
                  <GlassText variant="caption" className="normal-case text-[11px] text-content-muted" numberOfLines={1}>
                    {item.email}
                  </GlassText>
                </View>
                <TouchableOpacity
                  disabled={adding}
                  onPress={() => addMember(item, () => fetchSuggestions())}
                  className="h-8 w-8 items-center justify-center rounded-lg border border-accent/30 bg-accent/15"
                >
                  {adding ? <Loader size="small" /> : <UserPlus size={14} color={colors.accent} />}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  if (inviteCode) {
    return (
      <SafeAreaView className="flex-1" edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            className="px-6"
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 items-center justify-center py-8">
              <View className="mb-6 h-20 w-20 items-center justify-center rounded-[28px] border border-success/30 bg-success/20 shadow-lg shadow-success/20">
                <Check size={40} color={colors.success} />
              </View>

              <GlassText variant="h1" className="mb-2 text-center text-3xl">
                {t('createGroup.successTitle')}
              </GlassText>
              <GlassText variant="body" className="mb-6 px-6 text-center text-content-muted">
                {t('createGroup.successDesc')}
              </GlassText>

              <GlassCard
                intensity={45}
                className="mb-6 w-full items-center border-success/20"
                padding="p-6"
              >
                <GlassText variant="caption" className="mb-4 tracking-[4px]">
                  {t('createGroup.yourInviteCode')}
                </GlassText>
                <GlassText className="mb-6 font-outfit-bold text-5xl tracking-tighter text-accent">
                  {inviteCode}
                </GlassText>

                <TouchableOpacity
                  onPress={copyToClipboard}
                  className={`flex-row items-center rounded-2xl border px-5 py-2.5 ${
                    copied ? 'border-success/30 bg-success/20' : 'border-surface-line bg-surface-fill'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check size={16} color={colors.success} style={{ marginRight: 6 }} />
                      <GlassText className="font-outfit-bold text-success">
                        {t('createGroup.copied')}
                      </GlassText>
                    </>
                  ) : (
                    <>
                      <Copy size={16} color={colors.content} style={{ marginRight: 6 }} />
                      <GlassText className="font-outfit-bold">{t('createGroup.copyCode')}</GlassText>
                    </>
                  )}
                </TouchableOpacity>
              </GlassCard>

              {/* Members Adding Section */}
              <GlassCard
                intensity={35}
                className="mb-8 w-full border-surface-line"
                padding="p-5"
              >
                <View className="mb-3 flex-row items-center gap-2">
                  <UserPlus size={18} color={colors.accent} />
                  <GlassText className="font-outfit-bold text-base">
                    {t('addMember.title')}
                  </GlassText>
                </View>
                <GlassText variant="caption" className="mb-4 text-content-muted normal-case font-outfit-regular">
                  {t('addMember.instruction')}
                </GlassText>

                <Input
                  icon={Search}
                  placeholder={t('addMember.searchPlaceholder')}
                  value={query}
                  onChangeText={search}
                  autoCapitalize="none"
                  autoCorrect={false}
                  containerClassName="mb-3"
                />

                {renderMemberSuggestions()}

                {renderMemberResults()}
              </GlassCard>

              <Button
                title={t('createGroup.backHome')}
                variant="secondary"
                onPress={() => router.push('/(tabs)')}
                className="w-full font-outfit-bold"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <GlassHeader title={t('createGroup.title')} showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          className="px-6"
        >
          <View className="pb-32 pt-4">
            <View className="mb-10 items-center">
              <View className="h-24 w-24 items-center justify-center rounded-[32px] border border-accent/20 bg-accent/10 shadow-lg shadow-accent/10">
                <Users size={40} color={colors.accent} />
              </View>
            </View>

            <GlassCard intensity={30} className="mb-10" padding="p-6">
              <View className="gap-8">
                <Input
                  label={t('createGroup.nameLabel')}
                  icon={Users}
                  placeholder={t('createGroup.namePlaceholder')}
                  value={groupName}
                  onChangeText={setGroupName}
                />
                <Input
                  label={t('createGroup.budgetLabel')}
                  icon={Wallet}
                  placeholder={t('createGroup.budgetPlaceholder')}
                  value={budgetAmount}
                  onChangeText={(v) => setBudgetAmount(formatAmountInput(v))}
                  keyboardType="numeric"
                  trailing={
                    <View className="rounded-md border border-surface-line bg-surface-fill px-2 py-1">
                      <GlassText className="font-outfit-bold text-[10px] text-content-muted">
                        {t('common.vnd')}
                      </GlassText>
                    </View>
                  }
                />
                <Input
                  label={t('createGroup.descLabel')}
                  icon={FileText}
                  placeholder={t('createGroup.descPlaceholder')}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  textAlignVertical="top"
                  className="min-h-[100px]"
                />
              </View>
            </GlassCard>

            <Button
              title={loading ? t('common.processing') : t('createGroup.submit')}
              onPress={handleCreateGroup}
              loading={loading}
              disabled={!groupName}
              className="w-full"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
