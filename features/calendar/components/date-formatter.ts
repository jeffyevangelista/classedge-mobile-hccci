import dayjs from "dayjs";

export const formatDate = (date: string) => {
  return dayjs(date).format("MMMM DD, YYYY");
};

export const formatTime = (time: string) => {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
};

export const formatDateTime = (date: string) => {
  return dayjs(date).format("MMMM DD, YYYY hh:mm A");
};
