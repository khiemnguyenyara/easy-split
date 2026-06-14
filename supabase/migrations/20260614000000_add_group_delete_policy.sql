-- Allow group creators (owners) to delete their groups.
-- Cascading constraints will automatically clean up related rows in other tables.
DROP POLICY IF EXISTS "Group owners can delete their groups" ON public.groups;

CREATE POLICY "Group owners can delete their groups" ON public.groups
FOR DELETE USING (auth.uid() = created_by);
