import React, { useState, useEffect } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Users, FileText, Copy, Check, Wallet, Search, UserPlus, X } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useCreateGroup } from '../src/hooks/useCreateGroup';
import { useAuthStore } from '../src/store/useAuthStore';
import { supabase } from '../src/api/supabase';
import { groupService } from '../src/services/group.service';
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
  const { user } = useAuthStore();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [copied, setCopied] = useState(false);

  // States for pre-creation member search and selection
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  const { createGroup, loading, inviteCode } = useCreateGroup();

  // Fetch local suggestions on mount
  useEffect(() => {
    const fetchLocalSuggestions = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .neq('user_id', user.id)
          .limit(3);
        if (error) throw error;
        setSuggestions(data || []);
      } catch (err) {
        console.error('Error fetching local suggestions:', err);
      }
    };
    fetchLocalSuggestions();
  }, [user]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, avatar_url')
        .neq('user_id', user?.id || '')
        .or(`full_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
        .limit(10);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error('Error searching profiles:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const toggleSelectMember = (member: any) => {
    setSelectedMembers((prev) => {
      const exists = prev.some((m) => m.user_id === member.user_id);
      if (exists) {
        return prev.filter((m) => m.user_id !== member.user_id);
      } else {
        return [...prev, member];
      }
    });
  };

  const handleCreateGroup = async () => {
    setCreating(true);
    const result = await createGroup(groupName, description, budgetAmount);
    if (result && result.success && result.groupId) {
      // Loop over and add selected members to the newly created group in DB
      try {
        for (const member of selectedMembers) {
          await groupService.addMemberToGroup(result.groupId, member.user_id);
        }
      } catch (err) {
        console.error('Error adding members to new group:', err);
      }
    }
    setCreating(false);
  };

  const copyToClipboard = async () => {
    if (inviteCode) {
      await Clipboard.setStringAsync(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderSelectedMembers = () => {
    if (selectedMembers.length === 0) return null;
    return (
      <View className="mb-4">
        <GlassText
          variant="caption"
          className="mb-2 tracking-widest text-[10px] text-content-muted uppercase font-outfit-bold"
        >
          {t('createGroup.selectedMembers') || 'Selected'} ({selectedMembers.length})
        </GlassText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
          {selectedMembers.map((item) => (
            <TouchableOpacity
              key={item.user_id}
              onPress={() => toggleSelectMember(item)}
              activeOpacity={0.7}
              className="items-center mr-4 relative"
            >
              <Avatar name={item.full_name} size="md" />
              <GlassText
                className="mt-1 text-[11px] font-outfit-bold text-center"
                numberOfLines={1}
                style={{ maxWidth: 64 }}
              >
                {item.full_name?.split(' ')[0]}
              </GlassText>
              <View className="absolute -top-1 -right-1 h-4 w-4 items-center justify-center rounded-full bg-danger border border-white dark:border-[#201D47]">
                <X size={8} color="white" />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderLocalSearchResults = () => {
    const trimmed = searchQuery.trim();
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

    if (searchResults.length === 0) {
      return (
        <View className="py-4 items-center justify-center">
          <GlassText
            variant="caption"
            className="text-content-faint text-center font-outfit-medium"
          >
            {t('addMember.emptyTitle')}
          </GlassText>
        </View>
      );
    }

    return (
      <View className="gap-2 mt-2">
        {searchResults.map((item) => {
          const isSelected = selectedMembers.some((m) => m.user_id === item.user_id);
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
                <GlassText
                  variant="caption"
                  className="normal-case text-[11px] text-content-muted"
                  numberOfLines={1}
                >
                  {item.email}
                </GlassText>
              </View>
              <TouchableOpacity
                onPress={() => toggleSelectMember(item)}
                className={`h-8 px-2.5 flex-row items-center justify-center rounded-lg border ${
                  isSelected ? 'border-success/30 bg-success/15' : 'border-accent/30 bg-accent/15'
                }`}
              >
                {isSelected ? (
                  <>
                    <Check size={12} color={colors.success} style={{ marginRight: 4 }} />
                    <GlassText className="font-outfit-bold text-xs text-success">
                      {t('addMember.addedLabel') || 'Added'}
                    </GlassText>
                  </>
                ) : (
                  <UserPlus size={14} color={colors.accent} />
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  const renderLocalSuggestions = () => {
    if (searchQuery.trim().length >= 2 || suggestions.length === 0) {
      return null;
    }

    return (
      <View className="mb-4">
        <GlassText
          variant="caption"
          className="mb-2 tracking-widest text-[10px] text-content-muted uppercase"
        >
          {t('addMember.suggestions')}
        </GlassText>
        <View className="gap-2">
          {suggestions.map((item) => {
            const isSelected = selectedMembers.some((m) => m.user_id === item.user_id);
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
                  <GlassText
                    variant="caption"
                    className="normal-case text-[11px] text-content-muted"
                    numberOfLines={1}
                  >
                    {item.email}
                  </GlassText>
                </View>
                <TouchableOpacity
                  onPress={() => toggleSelectMember(item)}
                  className={`h-8 px-2.5 flex-row items-center justify-center rounded-lg border ${
                    isSelected ? 'border-success/30 bg-success/15' : 'border-accent/30 bg-accent/15'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <Check size={12} color={colors.success} style={{ marginRight: 4 }} />
                      <GlassText className="font-outfit-bold text-xs text-success">
                        {t('addMember.addedLabel') || 'Added'}
                      </GlassText>
                    </>
                  ) : (
                    <UserPlus size={14} color={colors.accent} />
                  )}
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

              <GlassCard intensity={35} className="mb-8 w-full border-surface-line" padding="p-6">
                {/* Invite Code Section */}
                <View className="items-center w-full mb-6">
                  <GlassText variant="caption" className="mb-4 tracking-[4px]">
                    {t('createGroup.yourInviteCode')}
                  </GlassText>
                  <GlassText className="mb-6 font-outfit-bold text-5xl tracking-tighter text-accent">
                    {inviteCode}
                  </GlassText>

                  <TouchableOpacity
                    onPress={copyToClipboard}
                    className={`flex-row items-center rounded-2xl border px-5 py-2.5 ${
                      copied
                        ? 'border-success/30 bg-success/20'
                        : 'border-surface-line bg-surface-fill'
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
                        <GlassText className="font-outfit-bold">
                          {t('createGroup.copyCode')}
                        </GlassText>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
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
          keyboardShouldPersistTaps="handled"
        >
          <View className="pb-32 pt-4">
            <View className="mb-10 items-center">
              <View className="h-24 w-24 items-center justify-center rounded-[32px] border border-accent/20 bg-accent/10 shadow-lg shadow-accent/10">
                <Users size={40} color={colors.accent} />
              </View>
            </View>

            <GlassCard intensity={30} className="mb-6" padding="p-6">
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

            {/* Members Adding Section (moved inside creation phase) */}
            <GlassCard intensity={30} className="mb-8 w-full border-surface-line" padding="p-6">
              <View className="mb-3 flex-row items-center gap-2">
                <UserPlus size={18} color={colors.accent} />
                <GlassText className="font-outfit-bold text-base">{t('addMember.title')}</GlassText>
              </View>
              <GlassText
                variant="caption"
                className="mb-4 text-content-muted normal-case font-outfit-regular"
              >
                {t('addMember.instruction')}
              </GlassText>

              {renderSelectedMembers()}

              <Input
                icon={Search}
                placeholder={t('addMember.searchPlaceholder')}
                value={searchQuery}
                onChangeText={handleSearch}
                autoCapitalize="none"
                autoCorrect={false}
                containerClassName="mb-3"
              />

              {renderLocalSuggestions()}

              {renderLocalSearchResults()}
            </GlassCard>

            <Button
              title={creating || loading ? t('common.processing') : t('createGroup.submit')}
              onPress={handleCreateGroup}
              loading={creating || loading}
              disabled={!groupName || creating || loading}
              className="w-full"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
