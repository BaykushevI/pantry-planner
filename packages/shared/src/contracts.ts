// Event / job contracts for async processing

export type NotificationJobType =
  | "LOW_STOCK"
  | "REFILL_REMINDER"
  | "DAILY_DIGEST"
  | "WEEKLY_DIGEST";

export interface NotificationJob {
  type: NotificationJobType;
  userId: string;
  itemId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}
