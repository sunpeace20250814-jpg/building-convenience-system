import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================
export const entityIdSchema = z.string();
export const timestampSchema = z.string();

// ============================================================================
// Resident Schemas
// ============================================================================
export const residentSchema = z.object({
  id: z.string(),
  buildingId: z.string(),
  floor: z.string(),
  unitType: z.enum(['normal', 'rental']),
  unitNumber: z.string().optional(),
  statusId: z.string(),
  ownerName: z.string().min(1),
  renterName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('').optional()),
  moveInDate: z.string(),
  moveOutDate: z.string().optional(),
  deposit: z.number().optional(),
  monthlyRent: z.number().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  note: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createResidentSchema = residentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateResidentSchema = createResidentSchema.partial();

export const residentMemberSchema = z.object({
  id: z.string(),
  residentId: z.string(),
  name: z.string().min(1),
  phone: z.string().optional(),
  relationship: z.string().optional(),
  createdAt: z.string(),
});

export const createResidentMemberSchema = residentMemberSchema.omit({
  id: true,
  createdAt: true,
});

export const updateResidentMemberSchema = createResidentMemberSchema.partial();

export const residentKeycardSchema = z.object({
  id: z.string(),
  residentId: z.string(),
  cardNumber: z.string().min(1),
  note: z.string().optional(),
  createdAt: z.string(),
});

export const createResidentKeycardSchema = residentKeycardSchema.omit({
  id: true,
  createdAt: true,
});

export const updateResidentKeycardSchema = createResidentKeycardSchema.partial();

// ============================================================================
// Settings Schemas
// ============================================================================
export const buildingSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  normalFloorCount: z.number().int().min(0),
  rooftopFloorCount: z.number().int().min(0),
  basementFloorCount: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createBuildingSchema = buildingSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateBuildingSchema = createBuildingSchema.partial();

export const parkingSpotSchema = z.object({
  id: z.string(),
  buildingId: z.string(),
  floor: z.string(),
  number: z.string().min(1),
  type: z.enum(['motorcycle', 'car', 'large']),
  statusId: z.string(),
  boundResidentId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createParkingSpotSchema = parkingSpotSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateParkingSpotSchema = createParkingSpotSchema.partial();

export const statusOptionSchema = z.object({
  id: z.string(),
  type: z.enum(['resident', 'parking']),
  label: z.string().min(1),
  color: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

export const createStatusOptionSchema = statusOptionSchema.omit({ id: true });

export const updateStatusOptionSchema = createStatusOptionSchema.partial();

// ============================================================================
// Accounting Schemas
// ============================================================================
export const expenseRecordSchema = z.object({
  id: z.string(),
  type: z.enum(['income', 'expense']),
  date: z.string(),
  amount: z.number().min(0),
  categoryId: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createExpenseRecordSchema = expenseRecordSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateExpenseRecordSchema = createExpenseRecordSchema.partial();

export const expenseCategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
  color: z.string().optional(),
  sortOrder: z.number().int().min(0),
});

export const createExpenseCategorySchema = expenseCategorySchema.omit({ id: true });

export const updateExpenseCategorySchema = createExpenseCategorySchema.partial();

export const allowanceHolderSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  balance: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createAllowanceHolderSchema = allowanceHolderSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateAllowanceHolderSchema = createAllowanceHolderSchema.partial();

export const allowanceTransactionSchema = z.object({
  id: z.string(),
  allowanceId: z.string(),
  date: z.string(),
  amount: z.number().min(0),
  type: z.enum(['add', 'deduct']),
  description: z.string().optional(),
  balanceAfter: z.number(),
  createdAt: z.string(),
});

export const createAllowanceTransactionSchema = allowanceTransactionSchema.omit({
  id: true,
  balanceAfter: true,
  createdAt: true,
});

// ============================================================================
// Schedule Schemas
// ============================================================================
export const employeeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  phone: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createEmployeeSchema = employeeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const shiftStatusSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  label: z.string().min(1),
  color: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

export const createShiftStatusSchema = shiftStatusSchema.omit({ id: true });

export const updateShiftStatusSchema = createShiftStatusSchema.partial();

export const scheduleEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  shiftId: z.string(),
  assigneeId: z.string(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createScheduleEntrySchema = scheduleEntrySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateScheduleEntrySchema = createScheduleEntrySchema.partial();

export const holidaySchema = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string().min(1),
});

export const createHolidaySchema = holidaySchema.omit({ id: true });

export const updateHolidaySchema = createHolidaySchema.partial();

// ============================================================================
// Message Schemas
// ============================================================================
export const homeTabSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  order: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createHomeTabSchema = homeTabSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateHomeTabSchema = createHomeTabSchema.partial();

export const homeRecordSchema = z.object({
  id: z.string(),
  tabId: z.string(),
  title: z.string().min(1),
  content: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createHomeRecordSchema = homeRecordSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateHomeRecordSchema = createHomeRecordSchema.partial();

// ============================================================================
// Type Exports
// ============================================================================
export type ResidentInput = z.infer<typeof createResidentSchema>;
export type ResidentUpdate = z.infer<typeof updateResidentSchema>;
export type ResidentMemberInput = z.infer<typeof createResidentMemberSchema>;
export type ResidentMemberUpdate = z.infer<typeof updateResidentMemberSchema>;
export type ResidentKeycardInput = z.infer<typeof createResidentKeycardSchema>;
export type ResidentKeycardUpdate = z.infer<typeof updateResidentKeycardSchema>;

export type BuildingInput = z.infer<typeof createBuildingSchema>;
export type BuildingUpdate = z.infer<typeof updateBuildingSchema>;
export type ParkingSpotInput = z.infer<typeof createParkingSpotSchema>;
export type ParkingSpotUpdate = z.infer<typeof updateParkingSpotSchema>;
export type StatusOptionInput = z.infer<typeof createStatusOptionSchema>;
export type StatusOptionUpdate = z.infer<typeof updateStatusOptionSchema>;

export type ExpenseRecordInput = z.infer<typeof createExpenseRecordSchema>;
export type ExpenseRecordUpdate = z.infer<typeof updateExpenseRecordSchema>;
export type ExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
export type ExpenseCategoryUpdate = z.infer<typeof updateExpenseCategorySchema>;
export type AllowanceHolderInput = z.infer<typeof createAllowanceHolderSchema>;
export type AllowanceHolderUpdate = z.infer<typeof updateAllowanceHolderSchema>;
export type AllowanceTransactionInput = z.infer<typeof createAllowanceTransactionSchema>;

export type EmployeeInput = z.infer<typeof createEmployeeSchema>;
export type EmployeeUpdate = z.infer<typeof updateEmployeeSchema>;
export type ShiftStatusInput = z.infer<typeof createShiftStatusSchema>;
export type ShiftStatusUpdate = z.infer<typeof updateShiftStatusSchema>;
export type ScheduleEntryInput = z.infer<typeof createScheduleEntrySchema>;
export type ScheduleEntryUpdate = z.infer<typeof updateScheduleEntrySchema>;
export type HolidayInput = z.infer<typeof createHolidaySchema>;
export type HolidayUpdate = z.infer<typeof updateHolidaySchema>;

export type HomeTabInput = z.infer<typeof createHomeTabSchema>;
export type HomeTabUpdate = z.infer<typeof updateHomeTabSchema>;
export type HomeRecordInput = z.infer<typeof createHomeRecordSchema>;
export type HomeRecordUpdate = z.infer<typeof updateHomeRecordSchema>;
