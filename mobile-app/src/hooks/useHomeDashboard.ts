import { useState, useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { groupService } from '../services/group.service';
import { useGroupList } from './useGroupList';

export const useHomeDashboard = () => {
  const { user, signOut } = useAuthStore();

  // We reuse the useGroupList hook for groups logic instead of rewriting states
  const { groups, fetchGroups } = useGroupList();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [totalBalance, setTotalBalance] = useState(0);
  const [owedToUser, setOwedToUser] = useState(0);
  const [userOwes, setUserOwes] = useState(0);

  const fetchBalance = useCallback(async () => {
    if (!user) return;
    try {
      const balanceData = await groupService.getUserDashboardBalances(user.id);
      setOwedToUser(balanceData.owedToUser);
      setUserOwes(balanceData.userOwes);
      setTotalBalance(balanceData.totalBalance);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchGroups(), fetchBalance()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchGroups, fetchBalance]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  return {
    user,
    signOut,
    groups,
    totalBalance,
    owedToUser,
    userOwes,
    loading,
    refreshing,
    fetchData,
    onRefresh,
  };
};
