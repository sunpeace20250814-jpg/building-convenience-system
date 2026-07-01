export interface ExpenseCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
  sortOrder?: number;
}