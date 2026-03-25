// Core shared types (minimal, no business logic)

export type ID = string;

export type ItemStatus = "active" | "history";

export interface PantryItem {
  id: ID;
  userId: string;
  name: string;
  status: ItemStatus;
  notes?: string;
  lastBoughtAt?: string;
  snoozedUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: ID;
  username: string;
  displayName: string;
}

export interface SuggestedItem extends PantryItem {
  derivedCadenceDays: number;
  daysSinceLastBought: number;
  urgency: "due" | "due_soon";
}
