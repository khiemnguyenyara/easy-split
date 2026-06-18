-- RPC function to get all active pairwise debts the logged-in user owes to other users across all their groups.
CREATE OR REPLACE FUNCTION public.get_user_unpaid_debts()
RETURNS TABLE (
  group_id UUID,
  group_name TEXT,
  creditor_id UUID,
  creditor_name TEXT,
  amount NUMERIC
) AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  RETURN QUERY
  WITH raw_splits AS (
    SELECT 
      e.group_id,
      s.user_id AS debtor_id,
      e.payer_id AS creditor_id,
      SUM(s.share_amount) AS total_split
    FROM public.expense_splits s
    JOIN public.expenses e ON s.expense_id = e.expense_id
    WHERE e.group_id IN (
      SELECT m.group_id FROM public.group_members m WHERE m.user_id = v_user_id
    )
    GROUP BY e.group_id, s.user_id, e.payer_id
  ),
  raw_settlements AS (
    SELECT
      ds.group_id,
      ds.debtor_id,
      ds.creditor_id,
      SUM(ds.amount) AS total_settlement
    FROM public.debt_settlements ds
    WHERE ds.group_id IN (
      SELECT m.group_id FROM public.group_members m WHERE m.user_id = v_user_id
    )
    AND ds.status = 'confirmed'
    GROUP BY ds.group_id, ds.debtor_id, ds.creditor_id
  ),
  pairwise_debts AS (
    SELECT
      val.group_id,
      CASE WHEN val.debtor_id < val.creditor_id THEN val.debtor_id ELSE val.creditor_id END AS id_low,
      CASE WHEN val.debtor_id < val.creditor_id THEN val.creditor_id ELSE val.creditor_id END AS id_high,
      SUM(val.amount) AS net_amount
    FROM (
      SELECT group_id, debtor_id, creditor_id, total_split AS amount FROM raw_splits
      UNION ALL
      SELECT group_id, creditor_id, debtor_id, -total_split AS amount FROM raw_splits
      UNION ALL
      SELECT group_id, debtor_id, creditor_id, -total_settlement AS amount FROM raw_settlements
      UNION ALL
      SELECT group_id, creditor_id, debtor_id, total_settlement AS amount FROM raw_settlements
    ) val
    WHERE val.debtor_id <> val.creditor_id
    GROUP BY val.group_id, id_low, id_high
  ),
  unpaid_debts_normalized AS (
    SELECT 
      pd.group_id,
      CASE WHEN pd.net_amount > 0 THEN pd.id_low ELSE pd.id_high END AS debtor_id,
      CASE WHEN pd.net_amount > 0 THEN pd.id_high ELSE pd.id_low END AS creditor_id,
      ABS(pd.net_amount) AS amount
    FROM pairwise_debts pd
    WHERE ABS(pd.net_amount) >= 1
  )
  SELECT 
    ud.group_id,
    g.group_name::TEXT,
    ud.creditor_id,
    p.full_name::TEXT AS creditor_name,
    ud.amount::NUMERIC
  FROM unpaid_debts_normalized ud
  JOIN public.groups g ON ud.group_id = g.group_id
  JOIN public.profiles p ON ud.creditor_id = p.user_id
  WHERE ud.debtor_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
