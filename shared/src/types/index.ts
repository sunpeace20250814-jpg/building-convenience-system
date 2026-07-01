// ============================================================================
// Base Types
// ============================================================================
export type EntityId = string;
export type Timestamp = string;

// ============================================================================
// Resident Module
// ============================================================================
export interface Resident {
  id: EntityId;
  buildingId: EntityId;
  floor: string;
  unitType: 'normal' | 'rental';
  unitNumber?: string;
  statusId: EntityId;
  ownerName: string;
  renterName?: string;
  phone?: string;
  email?: string;
  moveInDate: Timestamp;
  moveOutDate?: Timestamp;
  deposit?: number;
  monthlyRent?: number;
  emergencyContact?: string;
  emergencyPhone?: string;
  note?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ResidentMember {
  id: EntityId;
  residentId: EntityId;
  name: string;
  phone?: string;
  relationship?: string;
  createdAt: Timestamp;
}

export interface ResidentKeycard {
  id: EntityId;
  residentId: EntityId;
  cardNumber: string;
  note?: string;
  createdAt: Timestamp;
}

// ============================================================================
// Settings Module
// ============================================================================
export interface Building {
  id: EntityId;
  name: string;
  normalFloorCount: number;
  rooftopFloorCount: number;
  basementFloorCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ParkingSpot {
  id: EntityId;
  buildingId: EntityId;
  floor: string;
  number: string;
  type: 'motorcycle' | 'car' | 'large';
  statusId: EntityId;
  boundResidentId?: EntityId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StatusOption {
  id: EntityId;
  type: 'resident' | 'parking';
  label: string;
  color: string;
  sortOrder: number;
}

// ============================================================================
// Accounting Module
// ============================================================================
export interface ExpenseRecord {
  id: EntityId;
  type: 'income' | 'expense';
  date: string;
  amount: number;
  categoryId: EntityId;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ExpenseCategory {
  id: EntityId;
  name: string;
  type: 'income' | 'expense';
  color?: string;
  sortOrder: number;
}

export interface AllowanceHolder {
  id: EntityId;
  name: string;
  balance: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AllowanceTransaction {
  id: EntityId;
  allowanceId: EntityId;
  date: string;
  amount: number;
  type: 'add' | 'deduct';
  description?: string;
  balanceAfter: number;
  createdAt: Timestamp;
}

// ============================================================================
// Schedule Module
// ============================================================================
export interface Employee {
  id: EntityId;
  name: string;
  phone?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ShiftStatus {
  id: EntityId;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
}

export interface ScheduleEntry {
  id: EntityId;
  date: string;
  shiftId: EntityId;
  assigneeId: EntityId;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Holiday {
  id: EntityId;
  date: string;
  name: string;
}

// ============================================================================
// Message Module
// ============================================================================
export interface HomeTab {
  id: EntityId;
  name: string;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface HomeRecord {
  id: EntityId;
  tabId: EntityId;
  title: string;
  content: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
