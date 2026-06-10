import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import i18n from '../i18n';
import { groupService } from '../services/group.service';
import { getErrorMessage } from '../utils/error';
import type { UserSearchResult } from '../types/models';

/** Minimum characters before we hit the backend search. */
const MIN_QUERY = 2;
/** Debounce so we don't fire a query on every keystroke. */
const DEBOUNCE_MS = 350;

export const useAddMember = (groupId: string) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against out-of-order responses overwriting newer results.
  const reqIdRef = useRef(0);

  const search = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const trimmed = text.trim();
      if (trimmed.length < MIN_QUERY) {
        setResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      debounceRef.current = setTimeout(async () => {
        const reqId = ++reqIdRef.current;
        try {
          const data = await groupService.searchUsersForGroup(groupId, trimmed);
          if (reqId === reqIdRef.current) setResults(data);
        } catch (error) {
          console.error('Error searching users:', error);
          if (reqId === reqIdRef.current) setResults([]);
        } finally {
          if (reqId === reqIdRef.current) setSearching(false);
        }
      }, DEBOUNCE_MS);
    },
    [groupId]
  );

  const addMember = useCallback(
    async (user: UserSearchResult, onAdded?: () => void) => {
      if (user.is_member) return;
      setAddingId(user.user_id);
      try {
        await groupService.addMemberToGroup(groupId, user.user_id);
        // Keep the user in the list but flag them as already in the group.
        setResults((prev) =>
          prev.map((u) => (u.user_id === user.user_id ? { ...u, is_member: true } : u))
        );
        Alert.alert(
          i18n.t('common.success'),
          i18n.t('addMember.added', { name: user.full_name || i18n.t('common.user') })
        );
        onAdded?.();
      } catch (error) {
        Alert.alert(
          i18n.t('common.error'),
          getErrorMessage(error) || i18n.t('common.somethingWrong')
        );
      } finally {
        setAddingId(null);
      }
    },
    [groupId]
  );

  return { query, results, searching, addingId, search, addMember };
};
