// types/dashboard.ts
export interface RecentVentureItem {
    id: string;
    name: string;
    status: string;
    pendingExpenses?: number;
    updatedAt: string;
    image?: string | null;
  }