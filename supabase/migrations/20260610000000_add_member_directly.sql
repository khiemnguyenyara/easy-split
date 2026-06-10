-- Add members to a group directly (search + add) instead of sharing an invite code.
-- Both functions are SECURITY DEFINER: search needs to read all profiles while
-- excluding current members, and add needs to insert a membership row plus a
-- notification for the new member (bypassing the per-user notifications RLS).

-- 1. Search users to add: match by full name OR email, excluding people already
-- in the group. Only members of the group may search (mirrors who can add).
CREATE OR REPLACE FUNCTION public.search_users_for_group(i_group_id uuid, i_query text)
RETURNS TABLE (user_id uuid, full_name text, email text, avatar_url text) AS $$
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
  SELECT p.user_id, p.full_name, p.email, p.avatar_url
  FROM public.profiles p
  WHERE (p.full_name ILIKE '%' || i_query || '%' OR p.email ILIKE '%' || i_query || '%')
    AND NOT EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = i_group_id AND gm.user_id = p.user_id
    )
  ORDER BY
    -- exact email match first, then alphabetical by name
    (lower(p.email) = lower(btrim(i_query))) DESC,
    p.full_name ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Add a member directly. Any existing member may add others (matches the
-- group_members INSERT RLS policy). Creates an in-app notification for the new
-- member so they know they were added.
CREATE OR REPLACE FUNCTION public.add_member_to_group(i_group_id uuid, i_user_id uuid)
RETURNS void AS $$
DECLARE
  g_name text;
  actor_name text;
BEGIN
  IF NOT public.is_member_of(i_group_id) THEN
    RAISE EXCEPTION 'Bạn không có quyền thêm thành viên vào nhóm này.';
  END IF;

  -- Target must exist.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = i_user_id) THEN
    RAISE EXCEPTION 'Không tìm thấy người dùng.';
  END IF;

  -- Already a member?
  IF EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = i_group_id AND user_id = i_user_id
  ) THEN
    RAISE EXCEPTION 'Người này đã ở trong nhóm.';
  END IF;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (i_group_id, i_user_id, 'member');

  SELECT group_name INTO g_name FROM public.groups WHERE group_id = i_group_id;
  SELECT full_name INTO actor_name FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.notifications (user_id, title, message, data)
  VALUES (
    i_user_id,
    'Bạn được thêm vào nhóm',
    COALESCE(actor_name, 'Ai đó') || ' đã thêm bạn vào ' || COALESCE(g_name, 'một nhóm'),
    jsonb_build_object(
      'type', 'member_added',
      'group_id', i_group_id,
      'group_name', g_name,
      'actor', actor_name
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
