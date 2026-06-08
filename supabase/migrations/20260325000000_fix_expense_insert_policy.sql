-- Fix: cho phép mọi thành viên nhóm ghi nhận khoản chi, dù người trả (payer) là ai.
-- Policy cũ bắt buộc auth.uid() = payer_id nên không ghi được "người khác đã trả".

-- 1. Expenses INSERT: chỉ cần là thành viên nhóm
DROP POLICY IF EXISTS "Members can create group expenses" ON public.expenses;

CREATE POLICY "Members can create group expenses" ON public.expenses
FOR INSERT WITH CHECK (
  public.is_member_of(group_id)
);

-- 2. Expense Splits INSERT: chỉ cần khoản chi cha thuộc nhóm mình là thành viên
DROP POLICY IF EXISTS "Payers can create splits" ON public.expense_splits;
DROP POLICY IF EXISTS "Members can create splits" ON public.expense_splits;

CREATE POLICY "Members can create splits" ON public.expense_splits
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.expenses
    WHERE expense_id = expense_splits.expense_id
    AND public.is_member_of(group_id)
  )
);
