from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import PATHS
from ..models import (
    AccountRecordModel,
    AppSettingsModel,
    AttendanceRecordModel,
    BackupRunModel,
    BankOptionModel,
    ExpenseRecordModel,
    GuardDocumentModel,
    GuardModel,
    InvoiceModel,
    RuntimeStateModel,
    SiteModel,
)
from ..schemas import (
    AccountRecordSchema,
    AttendanceRecordSchema,
    BackupRunSchema,
    BackupSettingsSchema,
    BankOptionSchema,
    DriveStatusSchema,
    ExpenseRecordSchema,
    GuardDocumentSchema,
    GuardSchema,
    InvoiceSchema,
    SiteSchema,
    StorageSettingsSchema,
)
from ..utils.serializers import dumps, loads


DEFAULT_BACKUP_SETTINGS = BackupSettingsSchema(
    pdfExportPath=(PATHS.app_data / "exports").as_posix()
)
DEFAULT_DRIVE_STATUS = DriveStatusSchema()


def _now_iso() -> str:
    return datetime.now().isoformat()


def _upsert(session: Session, model) -> None:
    session.merge(model)


def list_sites(session: Session) -> list[SiteSchema]:
    rows = session.scalars(select(SiteModel).order_by(SiteModel.name)).all()
    return [SiteSchema(id=r.id, name=r.name, clientName=r.client_name, contactNumber=r.contact_number, location=r.location, gstNo=r.gst_no) for r in rows]


def save_site(session: Session, payload: SiteSchema) -> SiteSchema:
    _upsert(session, SiteModel(id=payload.id, name=payload.name, client_name=payload.clientName, contact_number=payload.contactNumber, location=payload.location, gst_no=payload.gstNo or ""))
    return payload


def delete_site(session: Session, site_id: str) -> None:
    session.execute(delete(SiteModel).where(SiteModel.id == site_id))


def list_guards(session: Session) -> list[GuardSchema]:
    rows = session.scalars(select(GuardModel).order_by(GuardModel.name)).all()
    return [
        GuardSchema(
            id=r.id,
            name=r.name,
            code=r.code,
            phone=r.phone,
            aadhaar=r.aadhaar,
            siteId=r.site_id,
            salaryPerShift=r.salary_per_shift,
            foodCostPerShift=r.food_cost_per_shift,
            uniformDeduction=r.uniform_deduction,
            joiningDate=r.joining_date,
            status=r.status,
            idProofAadhaar=r.id_proof_aadhaar,
            idProofPan=r.id_proof_pan,
            idProofPhoto=r.id_proof_photo,
            idProofOthers=r.id_proof_others,
        )
        for r in rows
    ]


def save_guard(session: Session, payload: GuardSchema) -> GuardSchema:
    _upsert(
        session,
        GuardModel(
            id=payload.id,
            name=payload.name,
            code=payload.code,
            phone=payload.phone,
            aadhaar=payload.aadhaar,
            site_id=payload.siteId,
            salary_per_shift=payload.salaryPerShift,
            food_cost_per_shift=payload.foodCostPerShift,
            uniform_deduction=payload.uniformDeduction,
            joining_date=payload.joiningDate,
            status=payload.status,
            id_proof_aadhaar=payload.idProofAadhaar,
            id_proof_pan=payload.idProofPan,
            id_proof_photo=payload.idProofPhoto,
            id_proof_others=payload.idProofOthers,
        ),
    )
    return payload


def delete_guard(session: Session, guard_id: str) -> None:
    session.execute(delete(GuardModel).where(GuardModel.id == guard_id))


def list_attendance(session: Session) -> list[AttendanceRecordSchema]:
    rows = session.scalars(select(AttendanceRecordModel).order_by(AttendanceRecordModel.date)).all()
    return [
        AttendanceRecordSchema(
            id=r.id,
            guardId=r.guard_id,
            siteId=r.site_id,
            date=r.date,
            morning=loads(r.morning_json),
            evening=loads(r.evening_json),
            night=loads(r.night_json),
            overtimeHrs=r.overtime_hrs,
        )
        for r in rows
    ]


def save_attendance(session: Session, payload: AttendanceRecordSchema) -> AttendanceRecordSchema:
    record_id = payload.id or f"{payload.guardId}_{payload.date}"
    _upsert(
        session,
        AttendanceRecordModel(
            id=record_id,
            guard_id=payload.guardId,
            site_id=payload.siteId,
            date=payload.date,
            morning_json=dumps(payload.morning.model_dump()),
            evening_json=dumps(payload.evening.model_dump()),
            night_json=dumps(payload.night.model_dump()),
            overtime_hrs=payload.overtimeHrs,
        ),
    )
    payload.id = record_id
    return payload


def list_expenses(session: Session) -> list[ExpenseRecordSchema]:
    rows = session.scalars(select(ExpenseRecordModel).order_by(ExpenseRecordModel.date)).all()
    return [ExpenseRecordSchema(id=r.id, guardId=r.guard_id, date=r.date, amount=r.amount, reason=r.reason, type=r.type) for r in rows]


def save_expense(session: Session, payload: ExpenseRecordSchema) -> ExpenseRecordSchema:
    _upsert(session, ExpenseRecordModel(id=payload.id, guard_id=payload.guardId, date=payload.date, amount=payload.amount, reason=payload.reason, type=payload.type))
    return payload


def delete_expense(session: Session, expense_id: str) -> None:
    session.execute(delete(ExpenseRecordModel).where(ExpenseRecordModel.id == expense_id))


def list_accounts(session: Session) -> list[AccountRecordSchema]:
    rows = session.scalars(select(AccountRecordModel).order_by(AccountRecordModel.date.desc())).all()
    return [AccountRecordSchema(id=r.id, date=r.date, description=r.description, category=r.category, amount=r.amount, type=r.type, createdAt=r.created_at) for r in rows]


def save_account(session: Session, payload: AccountRecordSchema) -> AccountRecordSchema:
    _upsert(session, AccountRecordModel(id=payload.id, date=payload.date, description=payload.description, category=payload.category, amount=payload.amount, type=payload.type, created_at=payload.createdAt))
    return payload


def delete_account(session: Session, account_id: str) -> None:
    session.execute(delete(AccountRecordModel).where(AccountRecordModel.id == account_id))


def list_invoices(session: Session) -> list[InvoiceSchema]:
    rows = session.scalars(select(InvoiceModel).order_by(InvoiceModel.created_at)).all()
    return [
        InvoiceSchema(
            id=r.id,
            invoiceNumber=r.invoice_number,
            invoiceDate=r.invoice_date,
            invoiceType=r.invoice_type,
            company=loads(r.company_json),
            clientName=r.client_name,
            clientAddress=r.client_address,
            clientGstNumber=r.client_gst_number,
            lineItems=loads(r.line_items_json),
            subTotal=r.sub_total,
            cgstPercent=r.cgst_percent,
            sgstPercent=r.sgst_percent,
            cgstAmount=r.cgst_amount,
            sgstAmount=r.sgst_amount,
            totalAmount=r.total_amount,
            bankDetails=loads(r.bank_details_json),
            createdAt=r.created_at,
        )
        for r in rows
    ]


def save_invoice(session: Session, payload: InvoiceSchema) -> InvoiceSchema:
    _upsert(
        session,
        InvoiceModel(
            id=payload.id,
            invoice_number=payload.invoiceNumber,
            invoice_date=payload.invoiceDate,
            invoice_type=payload.invoiceType,
            company_json=dumps(payload.company.model_dump()),
            client_name=payload.clientName,
            client_address=payload.clientAddress,
            client_gst_number=payload.clientGstNumber,
            line_items_json=dumps([item.model_dump() for item in payload.lineItems]),
            sub_total=payload.subTotal,
            cgst_percent=payload.cgstPercent,
            sgst_percent=payload.sgstPercent,
            cgst_amount=payload.cgstAmount,
            sgst_amount=payload.sgstAmount,
            total_amount=payload.totalAmount,
            bank_details_json=dumps(payload.bankDetails.model_dump()),
            created_at=payload.createdAt,
        ),
    )
    return payload


def delete_invoice(session: Session, invoice_id: str) -> None:
    session.execute(delete(InvoiceModel).where(InvoiceModel.id == invoice_id))


def list_banks(session: Session) -> list[BankOptionSchema]:
    rows = session.scalars(select(BankOptionModel).order_by(BankOptionModel.bank_name)).all()
    return [BankOptionSchema(id=r.id, bankName=r.bank_name, accountName=r.account_name, accountNumber=r.account_number, ifsc=r.ifsc, upiId=r.upi_id) for r in rows]


def save_bank(session: Session, payload: BankOptionSchema) -> BankOptionSchema:
    _upsert(session, BankOptionModel(id=payload.id, bank_name=payload.bankName, account_name=payload.accountName, account_number=payload.accountNumber, ifsc=payload.ifsc, upi_id=payload.upiId or ""))
    return payload


def delete_bank(session: Session, bank_id: str) -> None:
    session.execute(delete(BankOptionModel).where(BankOptionModel.id == bank_id))


def list_documents(session: Session, guard_id: str | None = None) -> list[GuardDocumentSchema]:
    stmt = select(GuardDocumentModel).order_by(GuardDocumentModel.created_at)
    if guard_id:
        stmt = stmt.where(GuardDocumentModel.guard_id == guard_id)
    rows = session.scalars(stmt).all()
    return [
        GuardDocumentSchema(
            id=r.id,
            guardId=r.guard_id,
            documentType=r.document_type,
            originalName=r.original_name,
            storedName=r.stored_name,
            relativePath=r.relative_path,
            mimeType=r.mime_type,
            sizeBytes=r.size_bytes,
            checksumSha256=r.checksum_sha256,
            createdAt=r.created_at,
            driveFileId=r.drive_file_id,
            lastBackupAt=r.last_backup_at,
        )
        for r in rows
    ]


def save_document(session: Session, payload: GuardDocumentSchema) -> GuardDocumentSchema:
    _upsert(
        session,
        GuardDocumentModel(
            id=payload.id,
            guard_id=payload.guardId,
            document_type=payload.documentType,
            original_name=payload.originalName,
            stored_name=payload.storedName,
            relative_path=payload.relativePath,
            mime_type=payload.mimeType,
            size_bytes=payload.sizeBytes,
            checksum_sha256=payload.checksumSha256,
            created_at=payload.createdAt,
            drive_file_id=payload.driveFileId,
            last_backup_at=payload.lastBackupAt,
        ),
    )
    return payload


def delete_document(session: Session, document_id: str) -> None:
    session.execute(delete(GuardDocumentModel).where(GuardDocumentModel.id == document_id))


def list_backup_runs(session: Session) -> list[BackupRunSchema]:
    rows = session.scalars(select(BackupRunModel).order_by(BackupRunModel.started_at.desc())).all()
    return [BackupRunSchema(id=r.id, startedAt=r.started_at, finishedAt=r.finished_at, status=r.status, errorMessage=r.error_message, filesUploaded=r.files_uploaded, bytesUploaded=r.bytes_uploaded, destination=r.destination) for r in rows]


def create_backup_run(session: Session, destination: str) -> BackupRunSchema:
    payload = BackupRunSchema(id=uuid4().hex, startedAt=_now_iso(), status="running", destination=destination)
    _upsert(session, BackupRunModel(id=payload.id, started_at=payload.startedAt, status=payload.status, destination=destination))
    session.flush()
    return payload


def finish_backup_run(session: Session, run_id: str, *, status: str, error_message: str | None = None, files_uploaded: int = 0, bytes_uploaded: int = 0) -> None:
    row = session.get(BackupRunModel, run_id)
    if not row:
        return
    row.status = status
    row.error_message = error_message
    row.files_uploaded = files_uploaded
    row.bytes_uploaded = bytes_uploaded
    row.finished_at = _now_iso()


def get_storage_settings() -> StorageSettingsSchema:
    return StorageSettingsSchema(
        appDataPath=PATHS.app_data.as_posix(),
        databasePath=PATHS.database_file.as_posix(),
        documentsPath=PATHS.documents_dir.as_posix(),
        backupsPath=PATHS.backups_dir.as_posix(),
    )


def get_setting(session: Session, key: str, default):
    row = session.get(AppSettingsModel, key)
    if not row:
        return default
    return loads(row.value_json)


def set_setting(session: Session, key: str, value) -> None:
    _upsert(session, AppSettingsModel(key=key, value_json=dumps(value)))


def get_backup_settings(session: Session) -> BackupSettingsSchema:
    return BackupSettingsSchema(**get_setting(session, "backup", DEFAULT_BACKUP_SETTINGS.model_dump()))


def save_backup_settings(session: Session, payload: BackupSettingsSchema) -> BackupSettingsSchema:
    set_setting(session, "backup", payload.model_dump())
    return payload


def get_drive_status(session: Session) -> DriveStatusSchema:
    return DriveStatusSchema(**get_setting(session, "drive_status", DEFAULT_DRIVE_STATUS.model_dump()))


def save_drive_status(session: Session, payload: DriveStatusSchema) -> DriveStatusSchema:
    set_setting(session, "drive_status", payload.model_dump())
    return payload


def update_runtime_state(session: Session, key: str, value: str) -> None:
    _upsert(session, RuntimeStateModel(key=key, value=value, updated_at=datetime.now()))


def seed_defaults(session: Session) -> None:
    if session.scalar(select(GuardModel.id).limit(1)):
        return

    for site in (
        SiteSchema(id="s1", name="North Warehouse", clientName="Logistics Corp", contactNumber="9876543210", location="Industrial Area A", gstNo="29AAAAA0000A1Z5"),
        SiteSchema(id="s2", name="City Mall", clientName="Retail Giants", contactNumber="9123456780", location="City Center", gstNo="29BBBBB1111B1Z5"),
    ):
        save_site(session, site)

    for guard in (
        GuardSchema(id="g1", name="Rajesh Kumar", code="SG-101", phone="9988776655", aadhaar="1234-5678-9012", siteId="s1", salaryPerShift=600, foodCostPerShift=50, uniformDeduction=0, joiningDate="2023-01-15", status="Active"),
        GuardSchema(id="g2", name="Amit Singh", code="SG-102", phone="8877665544", aadhaar="5678-1234-9012", siteId="s1", salaryPerShift=550, foodCostPerShift=50, uniformDeduction=100, joiningDate="2023-03-10", status="Active"),
        GuardSchema(id="g3", name="Suresh Patil", code="SG-103", phone="7766554433", aadhaar="9012-5678-1234", siteId="s2", salaryPerShift=700, foodCostPerShift=60, uniformDeduction=0, joiningDate="2023-06-20", status="Active"),
    ):
        save_guard(session, guard)

    for bank in (
        BankOptionSchema(id="b1", bankName="HDFC BANK", accountName="BLACK CAT COMMANDO SECURITY FORCE", accountNumber="50200116920705", ifsc="HDFC0005519", upiId="9500427215@pz"),
        BankOptionSchema(id="b2", bankName="STATE BANK OF INDIA", accountName="KALKIRAJ", accountNumber="34434987057", ifsc="SBIN0009314", upiId=""),
    ):
        save_bank(session, bank)

    save_backup_settings(session, DEFAULT_BACKUP_SETTINGS)
    save_drive_status(session, DEFAULT_DRIVE_STATUS)
