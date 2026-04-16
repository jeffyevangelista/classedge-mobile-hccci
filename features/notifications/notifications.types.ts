export type Notification = {
  id: number;
  entityType: string;
  entityId: string;
  message: string;
  createdAt: string;
  createdById: string;
  createdBy: string;
  isRead: boolean;
  createdByPhoto: string;
};
