-- Allow a member to leave a group themselves (delete their own membership row).
-- The group creator cannot leave this way — they'd orphan the group, so they
-- must delete/hand over the group instead. This is a second permissive DELETE
-- policy; it is OR-combined with "Group owner can remove members", giving:
--   - owner  -> can remove other members (existing policy)
--   - member -> can remove only themselves (this policy)

DROP POLICY IF EXISTS "Members can leave a group" ON public.group_members;
CREATE POLICY "Members can leave a group" ON public.group_members
FOR DELETE USING (
    user_id = auth.uid()
    AND NOT EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.group_id = group_members.group_id
        AND g.created_by = auth.uid()
    )
);
