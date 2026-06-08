import { useState, useCallback } from 'react';
import { groupService } from '../services/group.service';
import type { AppNotification } from '../types/models';

export type { AppNotification } from '../types/models';

/** In-app notifications list with refresh + mark-all-read. */
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await groupService.getNotifications();
      setNotifications(data as AppNotification[]);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  /** Persist "all read" in the DB (called when leaving the screen). */
  const markAllRead = useCallback(async () => {
    try {
      await groupService.markNotificationsRead();
    } catch (error) {
      console.error('Error marking notifications read:', error);
    }
  }, []);

  /** Mark a single notification as read (optimistic). */
  const markOneRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
    );
    try {
      await groupService.markNotificationRead(id);
    } catch (error) {
      console.error('Error marking notification read:', error);
    }
  }, []);

  /** Delete a single notification (optimistic; re-fetch on failure to restore). */
  const removeNotification = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.notification_id !== id));
      try {
        await groupService.deleteNotification(id);
      } catch (error) {
        console.error('Error deleting notification:', error);
        fetchData();
      }
    },
    [fetchData]
  );

  return {
    notifications,
    loading,
    refreshing,
    fetchData,
    onRefresh,
    markAllRead,
    markOneRead,
    removeNotification,
  };
};
