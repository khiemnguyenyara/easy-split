import React from 'react';
import { View, FlatList, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Search, UserPlus, Users, Check, LucideIcon } from 'lucide-react-native';
import { useAddMember } from '../../../src/hooks/useAddMember';
import { useThemeColors } from '../../../src/theme';
import { Screen, Input, GlassText, Avatar, Loader } from '../../../src/components/ui';

export default function AddMemberScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams();
  const groupId = Array.isArray(id) ? id[0] : id;
  const { query, results, searching, addingId, search, addMember, suggestions, fetchSuggestions } = useAddMember(groupId);

  const trimmed = query.trim();

  // Plain (non-blur) hint so it doesn't flicker during the back transition.
  const renderHint = (Icon: LucideIcon, title: string, description: string) => (
    <View className="mt-16 items-center px-6">
      <View className="mb-6 h-16 w-16 items-center justify-center rounded-3xl border border-surface-line bg-surface-fill">
        <Icon size={32} color={colors.contentFaint} />
      </View>
      <GlassText variant="h3" className="mb-2 text-center">
        {title}
      </GlassText>
      <GlassText variant="body" className="px-4 text-center text-content-faint">
        {description}
      </GlassText>
    </View>
  );

  const renderSuggestions = () => {
    if (suggestions.length === 0) return null;
    return (
      <View className="mb-6">
        <GlassText variant="caption" className="mb-3 tracking-widest text-[10px] text-content-muted uppercase">
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
                  className="h-8 w-8 items-center justify-center rounded-xl border border-accent/30 bg-accent/15"
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

  const renderBody = () => {
    if (searching) return <Loader className="mt-12" />;

    if (trimmed.length < 2) {
      return (
        <View className="flex-1">
          {renderSuggestions()}
          {renderHint(Users, t('addMember.hintTitle'), t('addMember.hintDesc'))}
        </View>
      );
    }

    if (results.length === 0) {
      return renderHint(Search, t('addMember.emptyTitle'), t('addMember.emptyDesc'));
    }

    return (
      <FlatList
        data={results}
        keyExtractor={(item) => item.user_id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 128 }}
        renderItem={({ item }) => {
          const adding = addingId === item.user_id;
          return (
            <View
              className={`mb-3 flex-row items-center rounded-2xl border border-surface-line bg-surface-fill p-4 ${
                item.is_member ? 'opacity-60' : ''
              }`}
            >
              <Avatar name={item.full_name} size="lg" className="mr-4" />
              <View className="flex-1">
                <GlassText className="font-outfit-bold text-base" numberOfLines={1}>
                  {item.full_name}
                </GlassText>
                <GlassText variant="caption" className="normal-case" numberOfLines={1}>
                  {item.email}
                </GlassText>
              </View>
              {item.is_member ? (
                <View className="flex-row items-center rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5">
                  <Check size={13} color={colors.success} />
                  <GlassText className="ml-1 text-[11px] text-success">
                    {t('addMember.alreadyMember')}
                  </GlassText>
                </View>
              ) : (
                <TouchableOpacity
                  disabled={adding}
                  onPress={() => addMember(item)}
                  className="h-10 w-10 items-center justify-center rounded-xl border border-accent/30 bg-accent/15"
                >
                  {adding ? <Loader size="small" /> : <UserPlus size={18} color={colors.accent} />}
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    );
  };

  return (
    <Screen title={t('addMember.title')} showBack scroll={false} keyboardAvoiding>
      <View className="flex-1 px-6 pt-4">
        <GlassText variant="body" className="mb-4 text-content-muted">
          {t('addMember.instruction')}
        </GlassText>

        <Input
          icon={Search}
          placeholder={t('addMember.searchPlaceholder')}
          value={query}
          onChangeText={search}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          containerClassName="mb-4"
        />

        {renderBody()}
      </View>
    </Screen>
  );
}
