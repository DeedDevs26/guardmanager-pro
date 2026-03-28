export interface Site {
  id: string;
  name: string;
  clientName: string;
  contactNumber: string;
  location: string;
}

export interface Guard {
  id: string;
  name: string;
  code: string; // Employee Code
  phone: string;
  aadhaar: string;
  siteId: string; // Linked Site
  salaryPerShift: number;
  foodCostPerShift: number; // Deduction if food taken
  uniformDeduction: number; // One time or monthly
  joiningDate: string;
  status: 'Active' | 'Inactive';
}

export interface ShiftStatus {
  status: 'Present' | 'Absent' | 'Unmarked';
  foodTaken: boolean;
}

export interface AttendanceRecord {
  id: string;
  guardId: string;
  siteId: string;
  date: string; // YYYY-MM-DD
  morning: ShiftStatus;
  evening: ShiftStatus;
  night: ShiftStatus;
  overtimeHrs: number;
}

export interface ExpenseRecord {
  id: string;
  guardId: string;
  date: string;
  amount: number; // Advance amount
  reason: string;
  type: 'Advance' | 'Fine' | 'Other';
}

export interface SalarySlip {
  guardId: string;
  guardName: string;
  month: string; // YYYY-MM
  totalShifts: number; // Count of presents
  grossSalary: number;
  totalAdvance: number;
  totalFoodCost: number;
  uniformDeduction: number;
  netSalary: number;
}

// Invoice Types
export interface InvoiceLineItem {
  id: string;
  description: string;
  guards: number;
  days: number;
  rate: number;
  value: number; // auto: guards * days * rate
}

export interface InvoiceCompany {
  name: string;
  address: string;
  phone: string;
  email: string;
  pan: string;
}

export interface InvoiceBankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  company: InvoiceCompany;
  clientName: string;
  clientAddress: string;
  lineItems: InvoiceLineItem[];
  totalAmount: number;
  bankDetails: InvoiceBankDetails;
  createdAt: string;
}

// Navigation Types
export type ViewState = 'DASHBOARD' | 'GUARDS' | 'SITES' | 'ATTENDANCE' | 'EXPENSES' | 'SALARY' | 'INVOICE' | 'SETTINGS';