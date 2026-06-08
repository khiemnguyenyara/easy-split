-- Cho phép người dùng xóa thông báo của chính mình (phục vụ menu "..." trong app).
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;

CREATE POLICY "Users can delete their notifications" ON public.notifications
FOR DELETE USING (auth.uid() = user_id);
