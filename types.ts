export interface Site {
  id: string;
  name: string;
  clientName: string;
  contactNumber: string;
  location: string;
  gstNo?: string;
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
  idProofAadhaar?: string; 
  idProofPan?: string;
  idProofPhoto?: string;
  idProofOthers?: number; // Number of other files
}

export interface ShiftStatus {
  status: 'Present' | 'Absent' | 'Unmarked';
  foodTaken: boolean;
}

export interface AttendanceRecord {
  id: string;
  guardId: string;
  siteIds: string[];
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
  type: 'Advance' | 'Uniform' | 'Fine' | 'Other';
}

export interface AccountRecord {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: string;
  amount: number;
  type: 'expense' | 'income';
  createdAt: string; // ISO timestamp
}

export interface SalarySlip {
  guardId: string;
  guardName: string;
  month: string; // YYYY-MM
  totalShifts: number; // Count of presents
  grossSalary: number;
  totalAdvance: number;
  totalOthers?: number;
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
  gstNumber: string;
  sacCode?: string;
}

export interface InvoiceBankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  upiId?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType: 'with_gst' | 'without_gst';
  company: InvoiceCompany;
  clientName: string;
  clientAddress: string;
  clientGstNumber: string;
  lineItems: InvoiceLineItem[];
  subTotal: number;
  cgstPercent: number;
  sgstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  totalAmount: number;
  bankDetails: InvoiceBankDetails;
  createdAt: string;
}

// Navigation Types
export type ViewState = 'DASHBOARD' | 'GUARDS' | 'SITES' | 'ATTENDANCE' | 'EXPENSES' | 'SALARY' | 'INVOICE' | 'ACCOUNTS' | 'SETTINGS';

export interface BankOption extends InvoiceBankDetails {
  id: string;
}

export interface GuardDocument {
  id: string;
  guardId: string;
  documentType: string;
  originalName: string;
  storedName: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
  driveFileId?: string | null;
  lastBackupAt?: string | null;
}

export interface BackupSettings {
  driveEnabled: boolean;
  autoBackupEnabled: boolean;
  backupTime: string;
  backupFrequency: string;
  includeDatabase: boolean;
  includeDocuments: boolean;
  googleDriveFolderName: string;
  pdfExportPath: string;
}

export interface StorageSettings {
  appDataPath: string;
  databasePath: string;
  documentsPath: string;
  backupsPath: string;
}

export interface DriveStatus {
  connected: boolean;
  credentialsPath: string;
  folderName: string;
  lastError?: string | null;
}

export interface BackupRun {
  id: string;
  startedAt: string;
  finishedAt?: string | null;
  status: string;
  errorMessage?: string | null;
  filesUploaded: number;
  bytesUploaded: number;
  destination: string;
}

export interface BootstrapData {
  guards: Guard[];
  sites: Site[];
  attendance: AttendanceRecord[];
  expenses: ExpenseRecord[];
  invoices: Invoice[];
  accounts: AccountRecord[];
  banks: BankOption[];
}

export interface SettingsResponse {
  storage: StorageSettings;
  backup: BackupSettings;
  drive: DriveStatus;
  history: BackupRun[];
}
