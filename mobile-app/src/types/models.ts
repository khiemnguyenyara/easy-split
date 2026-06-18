/**
 * App-level domain types. Base rows are derived from the generated Supabase
 * types so they stay in sync with the schema; joined/flattened shapes that the
 * app actually consumes are defined explicitly.
 */
import type { Database } from './supabase';

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

export type Group = Row<'groups'>;
export type Fund = Row<'fundings'>;
export type DebtSettlementRow = Row<'debt_settlements'>;
export type NotificationRow = Row<'notifications'>;

/** A minimal profile reference embedded in joined queries. */
export interface ProfileRef {
  full_name: string | null;
}

/** Group member with its joined profile flattened onto the row. */
export interface GroupMember {
  user_id: string;
  role: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

/** A user surfaced by the "add member" search. */
export interface UserSearchResult {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  /** True when this user already belongs to the group. */
  is_member: boolean;
}

/** Expense as returned for the group dashboard (joined payer profile). */
export interface GroupExpense {
  expense_id: string;
  amount: number;
  description: string | null;
  category: string | null;
  created_at: string | null;
  payer_id: string | null;
  profiles: ProfileRef | null;
}

/** A single expense in the global cross-group feed. */
export interface FeedExpense {
  expense_id: string;
  amount: number;
  description: string | null;
  category: string | null;
  created_at: string;
  group_id: string;
  group_name: string;
  payer_name: string | null;
}

/** Net balance for a member within a group (positive = owed to them). */
export interface NetBalance {
  user_id: string;
  full_name: string | null;
  amount: number;
}

/** The user's net balance within a single group (debts overview). */
export interface GroupDebt {
  group_id: string;
  group_name: string;
  net: number;
}

/** A contribution toward a fund (with optional joined contributor profile). */
export interface FundContribution {
  contribution_id: string;
  funding_id: string;
  user_id: string;
  amount: number;
  proof_img: string | null;
  status: string | null;
  created_at: string | null;
  profiles?: ProfileRef | null;
}

export interface ChatMedia {
  url: string;
}

export interface ChatMessage {
  message_id: string;
  content: string | null;
  sender_id: string;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  } | null;
  media: ChatMedia[];
}

/** A simplified debt edge (who owes whom) in the settlement screen. */
export interface SimplifiedDebt {
  from_id: string;
  from_name: string;
  to_id: string;
  to_name: string;
  amount: number;
}

/** Everything the group dashboard screen needs. */
export interface GroupDashboard {
  group: Group | null;
  members: GroupMember[];
  expenses: GroupExpense[];
  netBalances: NetBalance[];
  /** Direct pairwise debts (A→B, B→C kept separate; no pass-through simplification). */
  rawDebts: SimplifiedDebt[];
  fundings: Fund[];
  pendingSettlements: DebtSettlementRow[];
}

/** Aggregated balance totals across all of the user's groups. */
export interface DebtTotals {
  owedToUser: number;
  userOwes: number;
  totalBalance: number;
}

export interface AppNotification {
  notification_id: string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  is_read: boolean | null;
  created_at: string | null;
}

export interface UnpaidDebt {
  group_id: string;
  group_name: string;
  creditor_id: string;
  creditor_name: string;
  amount: number;
}

