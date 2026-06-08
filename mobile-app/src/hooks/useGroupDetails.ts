import { useState, useCallback, useEffect } from 'react';
import { groupService } from '../services/group.service';
import type {
  Group,
  GroupMember,
  GroupExpense,
  NetBalance,
  SimplifiedDebt,
  Fund,
  DebtSettlementRow,
} from '../types/models';

export const useGroupDetails = (id: string | string[] | undefined) => {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<GroupExpense[]>([]);
  const [netBalances, setNetBalances] = useState<NetBalance[]>([]);
  const [rawDebts, setRawDebts] = useState<SimplifiedDebt[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [pendingSettlements, setPendingSettlements] = useState<DebtSettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      if (!id) {
        setLoading(false);
        return;
      }
      const groupId = Array.isArray(id) ? id[0] : id;

      const data = await groupService.getGroupDashboardData(groupId);

      setGroup(data.group);
      setMembers(data.members);
      setExpenses(data.expenses);
      setNetBalances(data.netBalances);
      setRawDebts(data.rawDebts);
      setFunds(data.fundings);
      setPendingSettlements(data.pendingSettlements);
    } catch (error) {
      console.error('Error fetching group details:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  return {
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
  };
};
