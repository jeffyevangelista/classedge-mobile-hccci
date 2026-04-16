export type EventItem = {
  id: string;
  title: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  eventTime: string;
  type: "event";
  location: string;
};

export type ActivityItem = {
  id: string;
  title: string;
  start: string; // ISO string
  end: string; // ISO string
  type: "activity";
  answered: boolean;
};

export type CalendarItem = EventItem | ActivityItem;

export type CustomMarkedDate = {
  marked?: boolean;
  dotColor?: string;

  // period markings
  startingDay?: boolean;
  endingDay?: boolean;
  color?: string;
  textColor?: string;

  // custom style (react-native-calendars)
  customStyles?: {
    container?: object;
    text?: object;
  };
};

export type MarkedDates = Record<string, CustomMarkedDate>;
