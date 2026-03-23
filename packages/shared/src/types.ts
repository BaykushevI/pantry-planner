// Core shared types (minimal, no business logic)

export type ID = string;

export interface PantryItem {
  id: ID;
  name: string;
  quantity: number;
  unit: string;
  lastBoughtAt?: string;
  refillFrequencyDays?: number;
  lowStockThreshold?: number;
}

export interface UserPreferences {
  userId: ID;
  remindersEnabled: boolean;
  dailyDigestEnabled: boolean;
  weeklyDigestEnabled: boolean;
}
