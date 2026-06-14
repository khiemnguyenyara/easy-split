-- Close the group ownership-hijack / invite-rotation hole.
--
-- The "Admins can update groups" RLS policy uses is_member_of(group_id), so ANY
-- member can UPDATE the groups row. That's intentional for collaborative fields
-- (e.g. budget_amount), but it also let a member reassign created_by to seize
-- ownership, or rotate invite_code to lock others out.
--
-- Rather than restricting all updates to the owner (which would break members
-- setting the budget), we lock just the two sensitive columns: only the current
-- owner may change created_by or invite_code. Everything else stays editable.

CREATE OR REPLACE FUNCTION public.guard_group_sensitive_columns()
RETURNS trigger AS $$
BEGIN
  IF (
    NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.invite_code IS DISTINCT FROM OLD.invite_code
  ) AND auth.uid() <> OLD.created_by THEN
    RAISE EXCEPTION 'Chỉ chủ nhóm mới được đổi quyền sở hữu hoặc mã mời.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_group_sensitive ON public.groups;
CREATE TRIGGER trg_guard_group_sensitive
BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.guard_group_sensitive_columns();
