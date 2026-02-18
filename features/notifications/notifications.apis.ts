import api from "@/lib/axios";
import { Notification } from "./notifications.types";

export const getNotifications = async ({
  pageParam = 1,
}): Promise<{
  count: number;
  next: string | null;
  previous: string | null;
  results: Notification[];
}> => {
  return (await api.get(`/notifications/?page=${pageParam}`)).data;
};

export const readNotification = async (id: number) => {
  return (await api.patch(`/notifications/${id}/`, { read: true })).data;
};

export const getNotificationCount = async () => {
  return (await api.get("/notifications/count/")).data;
};
