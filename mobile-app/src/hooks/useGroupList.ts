import { useState, useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { groupService } from '../services/group.service';

export interface GroupData {
  group_id: string;
  group_name: string;
  description: string | null;
  member_count: number;
}

export const useGroupList = () => {
  const { user } = useAuthStore();
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchGroups = useCallback(async () => {
    if (!user) {
      // Auth not resolved yet — don't leave the screen stuck on the spinner.
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await groupService.getUserGroups(user.id);
      setGroups(data);
      setFilteredGroups(data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroups();
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredGroups(groups);
      return;
    }
    const filtered = groups.filter(
      (g) =>
        g.group_name.toLowerCase().includes(text.toLowerCase()) ||
        (g.description && g.description.toLowerCase().includes(text.toLowerCase()))
    );
    setFilteredGroups(filtered);
  };

  return {
    groups,
    filteredGroups,
    loading,
    refreshing,
    searchQuery,
    fetchGroups,
    onRefresh,
    handleSearch,
  };
};
