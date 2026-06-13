import i18n from '../i18n';
import { supabase } from '../api/supabase';
import type {
  GroupDashboard,
  GroupMember,
  GroupExpense,
  NetBalance,
  SimplifiedDebt,
  FeedExpense,
  GroupDebt,
  DebtTotals,
  AppNotification,
  UserSearchResult,
} from '../types/models';

export interface CreateGroupPayload {
  group_name: string;
  description?: string;
  invite_code: string;
  created_by: string;
  budget_amount?: number;
}

/** A profile relation as returned by a Supabase join (object or 1-element array). */
type JoinedProfile = { full_name: string | null; avatar_url?: string | null };
type ProfileRel = JoinedProfile | JoinedProfile[] | null | undefined;

type RawMemberRow = { user_id: string; role: string | null; profiles: ProfileRel };
type RawExpenseRow = {
  expense_id: string;
  amount: number;
  description: string | null;
  category: string | null;
  created_at: string | null;
  payer_id: string | null;
  profiles: ProfileRel;
};

/** Normalize a Supabase to-one join (returned as object or 1-element array). */
const firstOf = <T>(rel: T | T[] | null | undefined): T | null =>
  Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);

const oneProfile = (rel: ProfileRel): JoinedProfile | null => firstOf(rel);
const profileName = (rel: ProfileRel): string | null => oneProfile(rel)?.full_name ?? null;

type GroupRel = { group_name: string | null } | { group_name: string | null }[] | null;

type RawFeedRow = {
  expense_id: string;
  amount: number;
  description: string | null;
  category: string | null;
  created_at: string | null;
  group_id: string | null;
  groups: GroupRel;
  profiles: ProfileRel;
};

type RawMembershipRow = { group_id: string; groups: GroupRel };
type RawPaidRow = {
  group_id: string | null;
  expense_splits: { user_id: string | null; share_amount: number }[] | null;
};
type RawOwesRow = {
  share_amount: number;
  expenses: { group_id: string | null } | { group_id: string | null }[] | null;
};
type RawOwesPayerRow = {
  share_amount: number;
  expenses: { payer_id: string | null } | { payer_id: string | null }[] | null;
};
type RawSettlementRow = {
  group_id: string | null;
  debtor_id: string | null;
  creditor_id: string | null;
  amount: number;
};

export const groupService = {
  /**
   * Create a new group and assign the creator as admin.
   */
  async createGroupWithAdmin(payload: CreateGroupPayload) {
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .insert([payload])
      .select()
      .single();

    if (groupError) throw groupError;

    if (groupData) {
      const { error: memberError } = await supabase.from('group_members').insert([
        {
          group_id: groupData.group_id,
          user_id: payload.created_by,
          role: 'admin',
        },
      ]);

      if (memberError) throw memberError;
    }

    return groupData;
  },

  /**
   * Join a group using an invite code via RPC.
   */
  async joinGroupByCode(code: string) {
    // @ts-ignore - Supabase type gen doesn't always pick up RPC endpoints
    const { data: groupId, error: joinError } = await supabase.rpc('join_group_by_code', {
      i_code: code,
    });

    if (joinError) throw joinError;

    return groupId;
  },

  /**
   * Search users (by name or email) who can be added to a group, excluding
   * people already in it. Returns at most 10 matches.
   */
  async searchUsersForGroup(groupId: string, query: string): Promise<UserSearchResult[]> {
    // @ts-ignore - Supabase type gen doesn't always pick up RPC endpoints
    const { data, error } = await supabase.rpc('search_users_for_group', {
      i_group_id: groupId,
      i_query: query,
    });

    if (error) throw error;

    return (data as UserSearchResult[]) || [];
  },

  /**
   * Add a user to a group directly (no invite code needed). The backend also
   * sends the new member an in-app notification.
   */
  async addMemberToGroup(groupId: string, userId: string) {
    // @ts-ignore - Supabase type gen doesn't always pick up RPC endpoints
    const { error } = await supabase.rpc('add_member_to_group', {
      i_group_id: groupId,
      i_user_id: userId,
    });

    if (error) throw error;
  },

  /**
   * Get all groups a user belongs to, including member count.
   */
  async getUserGroups(userId: string) {
    // 1. Get all group IDs the user belongs to
    const { data: memberOf, error: memberError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    if (memberError) throw memberError;

    if (!memberOf || memberOf.length === 0) {
      return [];
    }

    const groupIds = memberOf.map((m) => m.group_id);

    // 2. Fetch group details
    const { data: groupsData, error: groupsError } = await supabase
      .from('groups')
      .select('group_id, group_name, description')
      .in('group_id', groupIds);

    if (groupsError) throw groupsError;

    // 3. Get member counts for these groups
    const { data: counts, error: countsError } = await supabase
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds);

    if (countsError) throw countsError;

    const groupCounts = (counts || []).reduce<Record<string, number>>((acc, curr) => {
      acc[curr.group_id] = (acc[curr.group_id] || 0) + 1;
      return acc;
    }, {});

    const finalGroups = groupsData.map((g) => ({
      ...g,
      member_count: groupCounts[g.group_id] || 0,
    }));

    return finalGroups;
  },

  /**
   * Fetch full group details including members, expenses, and net balances.
   */
  async getGroupDashboardData(groupId: string): Promise<GroupDashboard> {
    // 1. Fetch group basic info
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('group_id', groupId)
      .single();

    if (groupError) throw groupError;

    // 2. Fetch members info
    const { data: membersData, error: membersError } = await supabase
      .from('group_members')
      .select(
        `
        user_id,
        role,
        profiles:profiles (
          full_name,
          avatar_url
        )
      `
      )
      .eq('group_id', groupId);

    if (membersError) throw membersError;

    // 3. Fetch expenses
    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select(
        `
        expense_id,
        amount,
        description,
        category,
        created_at,
        payer_id,
        profiles:profiles (
          full_name
        )
      `
      )
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (expensesError) throw expensesError;

    // 4. Calculate Net Balances
    const { data: splitsData, error: splitsError } = await supabase
      .from('expense_splits')
      .select('*, expenses!inner(group_id)')
      .eq('expenses.group_id', groupId);

    if (splitsError) throw splitsError;

    // 4a. Confirmed settlements — money already moved between members. Each one
    // (debtor D paid creditor C amount X) pays down the live debt: it is applied
    // to both the per-user net balances and the pairwise debts below.
    const { data: confirmedSettlements } = await supabase
      .from('debt_settlements')
      .select('debtor_id, creditor_id, amount')
      .eq('group_id', groupId)
      .eq('status', 'confirmed');

    // Normalize the joined rows into the app's flattened shapes. Supabase types
    // to-one joins loosely, so we narrow via a local raw shape.
    const rawMembers = (membersData ?? []) as unknown as RawMemberRow[];
    const members: GroupMember[] = rawMembers.map((m) => ({
      user_id: m.user_id,
      role: m.role,
      full_name: profileName(m.profiles),
      avatar_url: oneProfile(m.profiles)?.avatar_url ?? null,
    }));

    const expenses: GroupExpense[] = ((expensesData ?? []) as unknown as RawExpenseRow[]).map(
      (e) => ({
        expense_id: e.expense_id,
        amount: e.amount,
        description: e.description,
        category: e.category,
        created_at: e.created_at,
        payer_id: e.payer_id,
        profiles: oneProfile(e.profiles),
      })
    );

    const userBalances: Record<string, number> = {};
    members.forEach((m) => {
      userBalances[m.user_id] = 0;
    });

    expenses.forEach((exp) => {
      if (exp.payer_id) {
        userBalances[exp.payer_id] = (userBalances[exp.payer_id] || 0) + exp.amount;
      }
    });

    splitsData?.forEach((split) => {
      if (split.user_id) {
        userBalances[split.user_id] = (userBalances[split.user_id] || 0) - split.share_amount;
      }
    });

    // A confirmed settlement moves money: the debtor owes less (+), the
    // creditor is owed less (-). Net of all balances stays zero.
    confirmedSettlements?.forEach((s) => {
      const { debtor_id, creditor_id, amount } = s;
      if (debtor_id) userBalances[debtor_id] = (userBalances[debtor_id] || 0) + amount;
      if (creditor_id) userBalances[creditor_id] = (userBalances[creditor_id] || 0) - amount;
    });

    const exactBalances = members.map((m) => ({
      user_id: m.user_id,
      full_name: m.full_name || i18n.t('common.user'),
      exact: userBalances[m.user_id] || 0,
    }));

    const finalNetBalances: NetBalance[] = exactBalances.map((b) => ({
      user_id: b.user_id,
      full_name: b.full_name,
      amount: Math.round(b.exact),
    }));

    // Reconcile rounding drift so balances sum to zero (apply to entry with
    // largest absolute exact balance — least visible per-user error).
    const drift = finalNetBalances.reduce((s, r) => s + r.amount, 0);
    if (drift !== 0 && finalNetBalances.length > 0) {
      let idx = 0;
      for (let i = 1; i < exactBalances.length; i++) {
        if (Math.abs(exactBalances[i].exact) > Math.abs(exactBalances[idx].exact)) idx = i;
      }
      finalNetBalances[idx].amount -= drift;
    }

    finalNetBalances.sort((a, b) => b.amount - a.amount);

    // 4b. Raw pairwise debts: each split member owes the expense payer their share.
    // Net only WITHIN each pair (A vs B) — do NOT collapse chains (A→B→C stays separate).
    const payerByExpense: Record<string, string> = {};
    expenses.forEach((e) => {
      if (e.payer_id) payerByExpense[e.expense_id] = e.payer_id;
    });
    const nameById: Record<string, string> = {};
    members.forEach((m) => {
      nameById[m.user_id] = m.full_name || i18n.t('common.user');
    });

    // pairKey = "<idLow>|<idHigh>"; sign + => idLow owes idHigh, - => idHigh owes idLow.
    const pairNet: Record<string, number> = {};
    splitsData?.forEach((s) => {
      const creditor = s.expense_id ? payerByExpense[s.expense_id] : undefined;
      const debtor = s.user_id ?? undefined;
      if (!creditor || !debtor || creditor === debtor) return;
      const idLow = debtor < creditor ? debtor : creditor;
      const idHigh = debtor < creditor ? creditor : debtor;
      const sign = debtor === idLow ? 1 : -1;
      const key = `${idLow}|${idHigh}`;
      pairNet[key] = (pairNet[key] || 0) + sign * s.share_amount;
    });

    // Apply confirmed settlements to the pair, reducing the debtor→creditor debt
    // toward zero. Clamped so an over-payment (or a settlement made in simplified
    // mode against an indirect debt) can't flip the pair into a phantom reverse debt.
    confirmedSettlements?.forEach((s) => {
      const debtor = s.debtor_id ?? undefined;
      const creditor = s.creditor_id ?? undefined;
      if (!debtor || !creditor || debtor === creditor) return;
      const idLow = debtor < creditor ? debtor : creditor;
      const idHigh = debtor < creditor ? creditor : debtor;
      const sign = debtor === idLow ? 1 : -1;
      const key = `${idLow}|${idHigh}`;
      // Current debt the debtor owes the creditor (>= 0 means a real debt to settle).
      const debtorOwes = sign * (pairNet[key] || 0);
      pairNet[key] = sign * Math.max(0, debtorOwes - s.amount);
    });

    const rawDebts: SimplifiedDebt[] = [];
    Object.entries(pairNet).forEach(([key, amt]) => {
      if (Math.abs(amt) < 1) return;
      const [idLow, idHigh] = key.split('|');
      const fromId = amt > 0 ? idLow : idHigh;
      const toId = amt > 0 ? idHigh : idLow;
      rawDebts.push({
        from_id: fromId,
        from_name: nameById[fromId] ?? '',
        to_id: toId,
        to_name: nameById[toId] ?? '',
        amount: Math.round(Math.abs(amt)),
      });
    });

    // 5. Fetch group funds (for the group dashboard "Funds" tab preview)
    const { data: fundingsData } = await supabase
      .from('fundings')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    // 6. Pending settlements (proof submitted, awaiting confirmation)
    const { data: pendingData } = await supabase
      .from('debt_settlements')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'pending');

    return {
      group: groupData,
      members,
      expenses,
      netBalances: finalNetBalances,
      rawDebts,
      fundings: fundingsData ?? [],
      pendingSettlements: pendingData ?? [],
    };
  },

  /**
   * Fetch global total balance details for a specific user across all groups.
   */
  async getUserDashboardBalances(userId: string): Promise<DebtTotals> {
    // 1. Expenses the user paid → every other participant owes the user their share.
    const { data: userPaid, error: paidError } = await supabase
      .from('expenses')
      .select(
        `
        expense_id,
        amount,
        expense_splits (
          user_id,
          share_amount
        )
      `
      )
      .eq('payer_id', userId);

    if (paidError) throw paidError;

    // 2. Splits where the user took part but someone else paid → the user owes that payer.
    const { data: userOwesSplits, error: owesError } = await supabase
      .from('expense_splits')
      .select(
        `
        share_amount,
        expenses!inner (
          payer_id
        )
      `
      )
      .eq('user_id', userId)
      .neq('expenses.payer_id', userId);

    if (owesError) throw owesError;

    // 3. Confirmed settlements involving the user — money already moved.
    const { data: settlements, error: settlementsError } = await supabase
      .from('debt_settlements')
      .select('debtor_id, creditor_id, amount')
      .eq('status', 'confirmed')
      .or(`debtor_id.eq.${userId},creditor_id.eq.${userId}`);

    if (settlementsError) throw settlementsError;

    // Net position per counterparty: positive => they owe the user, negative =>
    // the user owes them. Netted pairwise — the same model as the group
    // dashboard. Deriving all three figures from these nets keeps them reconciled
    // (totalBalance === owedToUser - userOwes) and makes the home total equal the
    // sum of every group's balances (settlements included, exactly as netBalances).
    const net: Record<string, number> = {};
    const bump = (id: string | null | undefined, delta: number) => {
      if (!id || id === userId) return;
      net[id] = (net[id] || 0) + delta;
    };

    userPaid?.forEach((exp) => {
      exp.expense_splits?.forEach((split) => bump(split.user_id, split.share_amount));
    });

    (userOwesSplits as RawOwesPayerRow[] | null)?.forEach((split) => {
      bump(firstOf(split.expenses)?.payer_id, -split.share_amount);
    });

    // A confirmed settlement pays down the live debt between the two parties.
    settlements?.forEach((s) => {
      // Debtor paid the user back → they owe the user less.
      if (s.creditor_id === userId) bump(s.debtor_id, -s.amount);
      // The user paid the creditor → the user owes them less.
      else if (s.debtor_id === userId) bump(s.creditor_id, s.amount);
    });

    let owed = 0;
    let owes = 0;
    Object.values(net).forEach((amount) => {
      if (amount > 0) owed += amount;
      else owes += -amount;
    });

    return {
      owedToUser: owed,
      userOwes: owes,
      totalBalance: owed - owes,
    };
  },

  /** The user's in-app notifications (RLS-scoped to the signed-in user). */
  async getNotifications(): Promise<AppNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as unknown as AppNotification[];
  },

  /** Count of unread notifications for the signed-in user. */
  async getUnreadNotificationCount() {
    const { count, error } = await supabase
      .from('notifications')
      .select('notification_id', { count: 'exact', head: true })
      .eq('is_read', false);
    if (error) throw error;
    return count || 0;
  },

  /** Count unread chat-message notifications for a specific group (server truth). */
  async getGroupChatUnreadCount(groupId: string) {
    const { count, error } = await supabase
      .from('notifications')
      .select('notification_id', { count: 'exact', head: true })
      .eq('is_read', false)
      .filter('data->>type', 'eq', 'message_received')
      .filter('data->>group_id', 'eq', groupId);
    if (error) throw error;
    return count || 0;
  },

  /** Mark a group's chat-message notifications as read (when the user opens chat). */
  async markGroupChatRead(groupId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)
      .filter('data->>type', 'eq', 'message_received')
      .filter('data->>group_id', 'eq', groupId);
    if (error) throw error;
  },

  /** Mark all of the user's unread notifications as read. */
  async markNotificationsRead() {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);
    if (error) throw error;
  },

  /** Mark a single notification as read. */
  async markNotificationRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('notification_id', notificationId);
    if (error) throw error;
  },

  /** Delete a single notification (requires the delete RLS policy). */
  async deleteNotification(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('notification_id', notificationId);
    if (error) throw error;
  },

  /**
   * Global expense feed across every group the user belongs to (RLS scopes the
   * rows to the user's groups). Newest first.
   */
  async getUserExpensesFeed(): Promise<FeedExpense[]> {
    const { data, error } = await supabase
      .from('expenses')
      .select(
        `
        expense_id,
        amount,
        description,
        category,
        created_at,
        group_id,
        groups ( group_name ),
        profiles ( full_name )
      `
      )
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    const rows = (data ?? []) as unknown as RawFeedRow[];
    return rows.map((e) => ({
      expense_id: e.expense_id,
      amount: e.amount,
      description: e.description,
      category: e.category,
      created_at: e.created_at ?? '',
      group_id: e.group_id ?? '',
      group_name: firstOf(e.groups)?.group_name ?? '',
      payer_name: profileName(e.profiles),
    }));
  },

  /**
   * The user's net balance broken down per group (positive = owed to the user,
   * negative = the user owes). Reuses the same expense/split/settlement math as
   * the per-group dashboard.
   */
  async getUserDebtsByGroup(userId: string): Promise<GroupDebt[]> {
    // Groups the user is a member of.
    const { data: memberships, error: mErr } = await supabase
      .from('group_members')
      .select('group_id, groups ( group_name )')
      .eq('user_id', userId);
    if (mErr) throw mErr;

    const groups = ((memberships ?? []) as unknown as RawMembershipRow[]).map((m) => ({
      group_id: m.group_id,
      group_name: firstOf(m.groups)?.group_name ?? '',
    }));
    if (groups.length === 0) return [];

    const groupIds = groups.map((g) => g.group_id);

    // Expenses the user paid (with splits), scoped to those groups.
    const { data: paid } = await supabase
      .from('expenses')
      .select('group_id, amount, expense_splits ( user_id, share_amount )')
      .eq('payer_id', userId)
      .in('group_id', groupIds);

    // Splits the user owes in expenses paid by others.
    const { data: owesSplits } = await supabase
      .from('expense_splits')
      .select('share_amount, expenses!inner ( group_id, payer_id )')
      .eq('user_id', userId)
      .neq('expenses.payer_id', userId)
      .in('expenses.group_id', groupIds);

    // Confirmed settlements involving the user.
    const { data: settlements } = await supabase
      .from('debt_settlements')
      .select('group_id, debtor_id, creditor_id, amount, status')
      .in('group_id', groupIds)
      .eq('status', 'confirmed')
      .or(`debtor_id.eq.${userId},creditor_id.eq.${userId}`);

    const net: Record<string, number> = {};
    groupIds.forEach((g) => (net[g] = 0));

    ((paid ?? []) as unknown as RawPaidRow[]).forEach((exp) => {
      const gid = exp.group_id;
      if (!gid) return;
      exp.expense_splits?.forEach((s) => {
        if (s.user_id !== userId) net[gid] = (net[gid] || 0) + s.share_amount;
      });
    });
    ((owesSplits ?? []) as unknown as RawOwesRow[]).forEach((s) => {
      const gid = firstOf(s.expenses)?.group_id;
      if (gid) net[gid] = (net[gid] || 0) - s.share_amount;
    });
    ((settlements ?? []) as unknown as RawSettlementRow[]).forEach((s) => {
      if (!s.group_id) return;
      if (s.creditor_id === userId) net[s.group_id] = (net[s.group_id] || 0) - s.amount;
      else if (s.debtor_id === userId) net[s.group_id] = (net[s.group_id] || 0) + s.amount;
    });

    return groups
      .map((g) => ({ ...g, net: Math.round(net[g.group_id] || 0) }))
      .filter((g) => g.net !== 0)
      .sort((a, b) => b.net - a.net);
  },
};
