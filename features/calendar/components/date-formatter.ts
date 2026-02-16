import dayjs from "dayjs";

export const formatDate = (date: string) => {
  return dayjs(date).format("MMMM DD, YYYY");
};

export const formatTime = (time: string) => {
  return dayjs(`2025-01-01T${time}`).format("hh:mm A");
};

export const formatDateTime = (date: string) => {
  return dayjs(date).format("MMMM DD, YYYY hh:mm A");
};
