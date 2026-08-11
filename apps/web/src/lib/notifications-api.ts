import { apiClient } from "./api-client";

export interface Notification {
  id: string;
  type: "price_alert" | "budget_exceeded" | "bill_due" | "system";
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationList {
  items: Notification[];
  unread_count: number;
}

export async function listNotifications(unreadOnly = false): Promise<NotificationList> {
  const res = await apiClient.get<NotificationList>("/notifications", {
    params: { unread: unreadOnly },
  });
  return res.data;
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const res = await apiClient.patch<Notification>(`/notifications/${id}`);
  return res.data;
}

export async function markAllNotificationsRead(): Promise<{ marked_read: number }> {
  const res = await apiClient.post<{ marked_read: number }>("/notifications/read-all");
  return res.data;
}
