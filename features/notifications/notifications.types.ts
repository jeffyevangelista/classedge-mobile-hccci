export type Notification = {
  id: number;
  entity_type: string;
  entity_id: string;
  message: string;
  created_at: string;
  created_by_id: string;
  created_by: string;
  is_read: boolean;
  created_by_photo: string;
};
