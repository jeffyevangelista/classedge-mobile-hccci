export type ActivityAction =
  | "login"
  | "logout"
  | "open_subject"
  | "open_lesson"
  | "open_activity"
  | "start_activity"
  | "submit_activity"
  | "view_score"
  | "open_notification"
  | "open_announcement"
  | "open_calendar_event"
  | "open_profile";

export type EmitIds = {
  subjectId?: number;
  activityId?: string;
  moduleId?: number;
  entityType?: string;
  entityId?: string;
};

export type PendingEvent = {
  client_event_id: string;
  action: ActivityAction;
  subject_id?: number | null;
  activity_id?: string | null;
  module_id?: number | null;
  entity_type?: string | null;
  entity_id?: string | null;
  description?: string;
  occurred_at: string;
};

export type IngestResponse = {
  accepted: string[];
  duplicates: string[];
};
