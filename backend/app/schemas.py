from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class SiteSchema(BaseModel):
    id: str
    name: str
    clientName: str = ""
    contactNumber: str = ""
    location: str = ""
    gstNo: str = ""


class GuardSchema(BaseModel):
    id: str
    name: str
    code: str
    phone: str = ""
    aadhaar: str = ""
    siteId: str = ""
    salaryPerShift: float = 0
    foodCostPerShift: float = 0
    uniformDeduction: float = 0
    joiningDate: str
    status: Literal["Active", "Inactive"] = "Active"
    idProofAadhaar: str | None = None
    idProofPan: str | None = None
    idProofPhoto: str | None = None
    idProofOthers: int = 0


class ShiftStatusSchema(BaseModel):
    status: Literal["Present", "Absent", "Unmarked"] = "Unmarked"
    foodTaken: bool = False


class AttendanceRecordSchema(BaseModel):
    id: str = ""
    guardId: str
    siteIds: list[str] = []
    date: str
    morning: ShiftStatusSchema
    evening: ShiftStatusSchema
    night: ShiftStatusSchema
    overtimeHrs: float = 0


class ExpenseRecordSchema(BaseModel):
    id: str
    guardId: str
    date: str
    amount: float
    reason: str = ""
    type: Literal["Advance", "Uniform", "Fine", "Other"]


class AccountRecordSchema(BaseModel):
    id: str
    date: str
    description: str
    category: str
    amount: float
    type: Literal["expense", "income"]
    createdAt: str


class InvoiceLineItemSchema(BaseModel):
    id: str
    description: str
    guards: int
    days: int
    rate: float
    value: float


class InvoiceCompanySchema(BaseModel):
    name: str = ""
    address: str = ""
    phone: str = ""
    email: str = ""
    pan: str = ""
    gstNumber: str = ""
    sacCode: str = ""


class InvoiceBankDetailsSchema(BaseModel):
    bankName: str = ""
    accountName: str = ""
    accountNumber: str = ""
    ifsc: str = ""
    upiId: str = ""


class InvoiceSchema(BaseModel):
    id: str
    invoiceNumber: str
    invoiceDate: str
    invoiceType: Literal["with_gst", "without_gst"]
    company: InvoiceCompanySchema
    clientName: str = ""
    clientAddress: str = ""
    clientGstNumber: str = ""
    lineItems: list[InvoiceLineItemSchema]
    subTotal: float
    cgstPercent: float
    sgstPercent: float
    cgstAmount: float
    sgstAmount: float
    totalAmount: float
    bankDetails: InvoiceBankDetailsSchema
    createdAt: str


class BankOptionSchema(InvoiceBankDetailsSchema):
    id: str


class GuardDocumentSchema(BaseModel):
    id: str
    guardId: str
    documentType: str
    originalName: str
    storedName: str
    relativePath: str
    mimeType: str
    sizeBytes: int
    checksumSha256: str
    createdAt: str
    driveFileId: str | None = None
    lastBackupAt: str | None = None


class BackupSettingsSchema(BaseModel):
    driveEnabled: bool = False
    autoBackupEnabled: bool = False
    backupTime: str = "21:00"
    backupFrequency: str = "daily"
    includeDatabase: bool = True
    includeDocuments: bool = True
    googleDriveFolderName: str = "GuardManager Pro"
    pdfExportPath: str = ""


class StorageSettingsSchema(BaseModel):
    appDataPath: str
    databasePath: str
    documentsPath: str
    backupsPath: str


class DriveStatusSchema(BaseModel):
    connected: bool = False
    folderName: str = "GuardManager Pro"
    lastError: str | None = None


class BackupRunSchema(BaseModel):
    id: str
    startedAt: str
    finishedAt: str | None = None
    status: str
    errorMessage: str | None = None
    filesUploaded: int = 0
    bytesUploaded: int = 0
    destination: str = "local"
    isAutomatic: bool = False


class BootstrapSchema(BaseModel):
    guards: list[GuardSchema]
    sites: list[SiteSchema]
    attendance: list[AttendanceRecordSchema]
    expenses: list[ExpenseRecordSchema]
    invoices: list[InvoiceSchema]
    accounts: list[AccountRecordSchema]
    banks: list[BankOptionSchema]


class SettingsResponseSchema(BaseModel):
    storage: StorageSettingsSchema
    backup: BackupSettingsSchema
    drive: DriveStatusSchema
    history: list[BackupRunSchema]


class PDFExportSchema(BaseModel):
    filename: str
    base64: str


class StatusMessageSchema(BaseModel):
    ok: bool = True
    message: str
    data: dict[str, Any] = Field(default_factory=dict)
