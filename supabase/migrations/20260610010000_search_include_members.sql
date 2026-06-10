-- Update search_users_for_group to also return people already in the group,
-- flagged via a new is_member column (so the UI can show an "already in group"
-- note instead of hiding them).
--
-- The return signature changes (new column), so the function must be dropped
-- first — Postgres won't let CREATE OR REPLACE alter the output columns.

DROP FUNCTION IF EXISTS public.search_users_for_group(uuid, text);

CREATE FUNCTION public.search_users_for_group(i_group_id uuid, i_query text)
RETURNS TABLE (user_id uuid, full_name text, email text, avatar_url text, is_member boolean) AS $$
BEGIN
  -- Caller must belong to the group.
  IF NOT public.is_member_of(i_group_id) THEN
    RAISE EXCEPTION 'Bạn không có quyền thêm thành viên vào nhóm này.';
  END IF;

  -- Require a minimum query length to avoid dumping the whole user directory.
  IF i_query IS NULL OR length(btrim(i_query)) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    p.email,
    p.avatar_url,
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = i_group_id AND gm.user_id = p.user_id
    ) AS is_member
  FROM public.profiles p
  WHERE (p.full_name ILIKE '%' || i_query || '%' OR p.email ILIKE '%' || i_query || '%')
  ORDER BY
    -- addable users first, then exact email match, then alphabetical by name
    is_member ASC,
    (lower(p.email) = lower(btrim(i_query))) DESC,
    p.full_name ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
