from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class SiteModel(Base):
    __tablename__ = "sites"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    client_name: Mapped[str] = mapped_column(String, default="", nullable=False)
    contact_number: Mapped[str] = mapped_column(String, default="", nullable=False)
    location: Mapped[str] = mapped_column(String, default="", nullable=False)
    gst_no: Mapped[str] = mapped_column(String, default="", nullable=False)


class GuardModel(Base):
    __tablename__ = "guards"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, default="", nullable=False)
    aadhaar: Mapped[str] = mapped_column(String, default="", nullable=False)
    site_id: Mapped[str] = mapped_column(String, default="", nullable=False)
    salary_per_shift: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    food_cost_per_shift: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    uniform_deduction: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    joining_date: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="Active", nullable=False)
    id_proof_aadhaar: Mapped[str | None] = mapped_column(String, nullable=True)
    id_proof_pan: Mapped[str | None] = mapped_column(String, nullable=True)
    id_proof_photo: Mapped[str | None] = mapped_column(String, nullable=True)
    id_proof_others: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class AttendanceRecordModel(Base):
    __tablename__ = "attendance_records"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    guard_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    site_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    date: Mapped[str] = mapped_column(String, nullable=False, index=True)
    morning_json: Mapped[str] = mapped_column(Text, nullable=False)
    evening_json: Mapped[str] = mapped_column(Text, nullable=False)
    night_json: Mapped[str] = mapped_column(Text, nullable=False)
    overtime_hrs: Mapped[float] = mapped_column(Float, default=0, nullable=False)


class ExpenseRecordModel(Base):
    __tablename__ = "expenses"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    guard_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    date: Mapped[str] = mapped_column(String, nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[str] = mapped_column(Text, default="", nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)


class AccountRecordModel(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    date: Mapped[str] = mapped_column(String, nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class InvoiceModel(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    invoice_number: Mapped[str] = mapped_column(String, nullable=False)
    invoice_date: Mapped[str] = mapped_column(String, nullable=False)
    invoice_type: Mapped[str] = mapped_column(String, nullable=False)
    company_json: Mapped[str] = mapped_column(Text, nullable=False)
    client_name: Mapped[str] = mapped_column(String, default="", nullable=False)
    client_address: Mapped[str] = mapped_column(Text, default="", nullable=False)
    client_gst_number: Mapped[str] = mapped_column(String, default="", nullable=False)
    line_items_json: Mapped[str] = mapped_column(Text, nullable=False)
    sub_total: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    cgst_percent: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    sgst_percent: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    cgst_amount: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    sgst_amount: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    bank_details_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class BankOptionModel(Base):
    __tablename__ = "banks"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    bank_name: Mapped[str] = mapped_column(String, nullable=False)
    account_name: Mapped[str] = mapped_column(String, nullable=False)
    account_number: Mapped[str] = mapped_column(String, nullable=False)
    ifsc: Mapped[str] = mapped_column(String, nullable=False)
    upi_id: Mapped[str] = mapped_column(String, default="", nullable=False)


class GuardDocumentModel(Base):
    __tablename__ = "guard_documents"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    guard_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    document_type: Mapped[str] = mapped_column(String, nullable=False)
    original_name: Mapped[str] = mapped_column(String, nullable=False)
    stored_name: Mapped[str] = mapped_column(String, nullable=False)
    relative_path: Mapped[str] = mapped_column(String, nullable=False)
    mime_type: Mapped[str] = mapped_column(String, default="", nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    checksum_sha256: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    drive_file_id: Mapped[str | None] = mapped_column(String, nullable=True)
    last_backup_at: Mapped[str | None] = mapped_column(String, nullable=True)


class AppSettingsModel(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value_json: Mapped[str] = mapped_column(Text, nullable=False)


class BackupRunModel(Base):
    __tablename__ = "backup_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    started_at: Mapped[str] = mapped_column(String, nullable=False)
    finished_at: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    files_uploaded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bytes_uploaded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    destination: Mapped[str] = mapped_column(String, default="local", nullable=False)


class RuntimeStateModel(Base):
    __tablename__ = "runtime_state"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
