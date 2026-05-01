import base64
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .config import PATHS, ensure_directories
from .database import Base, engine, get_db, session_scope
from .schemas import (
    AccountRecordSchema,
    AttendanceRecordSchema,
    BackupSettingsSchema,
    BankOptionSchema,
    BootstrapSchema,
    DriveStatusSchema,
    ExpenseRecordSchema,
    GuardSchema,
    InvoiceSchema,
    PDFExportSchema,
    SettingsResponseSchema,
    SiteSchema,
    StatusMessageSchema,
)
from .services import backup_manager, repository
from .services.documents import store_document
from .services.drive_backup import connect_google_drive, disconnect_google_drive, ensure_task_scheduler, remove_task_scheduler


def create_app() -> FastAPI:
    ensure_directories()
    Base.metadata.create_all(bind=engine)
    with session_scope() as session:
        repository.seed_defaults(session)

    app = FastAPI(title="GuardManager Pro Desktop API")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    @app.get("/api/bootstrap", response_model=BootstrapSchema)
    def bootstrap(db: Session = Depends(get_db)) -> BootstrapSchema:
        return BootstrapSchema(
            guards=repository.list_guards(db),
            sites=repository.list_sites(db),
            attendance=repository.list_attendance(db),
            expenses=repository.list_expenses(db),
            invoices=repository.list_invoices(db),
            accounts=repository.list_accounts(db),
            banks=repository.list_banks(db),
        )

    @app.get("/api/settings", response_model=SettingsResponseSchema)
    def get_settings(db: Session = Depends(get_db)) -> SettingsResponseSchema:
        return SettingsResponseSchema(
            storage=repository.get_storage_settings(),
            backup=repository.get_backup_settings(db),
            drive=repository.get_drive_status(db),
            history=repository.list_backup_runs(db)[:10],
        )

    @app.put("/api/settings/backup", response_model=BackupSettingsSchema)
    def put_backup_settings(payload: BackupSettingsSchema, db: Session = Depends(get_db)) -> BackupSettingsSchema:
        saved = repository.save_backup_settings(db, payload)
        if payload.autoBackupEnabled:
            ensure_task_scheduler(payload.backupTime)
        else:
            remove_task_scheduler()
        return saved

    @app.post("/api/drive/connect", response_model=DriveStatusSchema)
    def drive_connect(db: Session = Depends(get_db)) -> DriveStatusSchema:
        try:
            status = connect_google_drive()
            return repository.save_drive_status(db, status)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to connect Google Drive: {str(e)}")

    @app.post("/api/drive/disconnect", response_model=StatusMessageSchema)
    def drive_disconnect(db: Session = Depends(get_db)) -> StatusMessageSchema:
        try:
            disconnect_google_drive()
            repository.save_drive_status(db, DriveStatusSchema(connected=False))
            return StatusMessageSchema(message="Google Drive disconnected")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to disconnect: {str(e)}")

    @app.post("/api/backup/run", response_model=StatusMessageSchema)
    def run_backup_now(db: Session = Depends(get_db)) -> StatusMessageSchema:
        try:
            results = backup_manager.run_backup(db, repository.get_backup_settings(db))
            return StatusMessageSchema(message="Backup completed", data={"history": [r.model_dump() for r in results]})
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")

    @app.get("/api/backup/history")
    def backup_history(db: Session = Depends(get_db)):
        return repository.list_backup_runs(db)

    @app.post("/api/backup/restore/{backup_id}", response_model=StatusMessageSchema)
    def restore_backup(backup_id: str):
        try:
            # Note: Restoring DB while FastAPI is running on it is tricky with SQLite.
            # But since this is a desktop app, we'll try it.
            backup_manager.restore_backup_bundle(backup_id)
            return StatusMessageSchema(message="Data restored successfully. Please restart the application for changes to take full effect.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")

    @app.post("/api/backup/import", response_model=StatusMessageSchema)
    def import_backup_file(payload: dict):
        try:
            path = payload.get("path")
            if not path:
                raise ValueError("No path provided")
            backup_manager.import_database_file(path)
            return StatusMessageSchema(message="Database imported successfully. Please restart the application.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

    @app.get("/api/guards", response_model=list[GuardSchema])
    def get_guards(db: Session = Depends(get_db)):
        return repository.list_guards(db)

    @app.put("/api/guards/{guard_id}", response_model=GuardSchema)
    def put_guard(guard_id: str, payload: GuardSchema, db: Session = Depends(get_db)):
        if guard_id != payload.id:
            raise HTTPException(status_code=400, detail="Guard id mismatch")
        return repository.save_guard(db, payload)

    @app.delete("/api/guards/{guard_id}", response_model=StatusMessageSchema)
    def remove_guard(guard_id: str, db: Session = Depends(get_db)):
        # BUG-01 fix: delete all associated documents from disk and DB first
        docs = repository.list_documents(db, guard_id)
        for doc in docs:
            file_path = PATHS.documents_dir / doc.relativePath
            if file_path.exists():
                file_path.unlink()
            repository.delete_document(db, doc.id)
        repository.delete_guard(db, guard_id)
        return StatusMessageSchema(message="Guard deleted")

    @app.get("/api/sites", response_model=list[SiteSchema])
    def get_sites(db: Session = Depends(get_db)):
        return repository.list_sites(db)

    @app.put("/api/sites/{site_id}", response_model=SiteSchema)
    def put_site(site_id: str, payload: SiteSchema, db: Session = Depends(get_db)):
        if site_id != payload.id:
            raise HTTPException(status_code=400, detail="Site id mismatch")
        return repository.save_site(db, payload)

    @app.delete("/api/sites/{site_id}", response_model=StatusMessageSchema)
    def remove_site(site_id: str, db: Session = Depends(get_db)):
        # BUG-02 fix: clear siteId on all guards assigned to this site
        repository.clear_site_from_guards(db, site_id)
        repository.delete_site(db, site_id)
        return StatusMessageSchema(message="Site deleted")

    @app.get("/api/attendance", response_model=list[AttendanceRecordSchema])
    def get_attendance(db: Session = Depends(get_db)):
        return repository.list_attendance(db)

    @app.put("/api/attendance/{record_id}", response_model=AttendanceRecordSchema)
    def put_attendance(record_id: str, payload: AttendanceRecordSchema, db: Session = Depends(get_db)):
        if payload.id and record_id != payload.id:
            raise HTTPException(status_code=400, detail="Attendance id mismatch")
        payload.id = record_id if record_id != "new" else payload.id
        return repository.save_attendance(db, payload)

    @app.get("/api/expenses", response_model=list[ExpenseRecordSchema])
    def get_expenses(db: Session = Depends(get_db)):
        return repository.list_expenses(db)

    @app.put("/api/expenses/{expense_id}", response_model=ExpenseRecordSchema)
    def put_expense(expense_id: str, payload: ExpenseRecordSchema, db: Session = Depends(get_db)):
        if expense_id != payload.id:
            raise HTTPException(status_code=400, detail="Expense id mismatch")
        return repository.save_expense(db, payload)

    @app.delete("/api/expenses/{expense_id}", response_model=StatusMessageSchema)
    def remove_expense(expense_id: str, db: Session = Depends(get_db)):
        repository.delete_expense(db, expense_id)
        return StatusMessageSchema(message="Expense deleted")

    @app.get("/api/accounts", response_model=list[AccountRecordSchema])
    def get_accounts(db: Session = Depends(get_db)):
        return repository.list_accounts(db)

    @app.put("/api/accounts/{account_id}", response_model=AccountRecordSchema)
    def put_account(account_id: str, payload: AccountRecordSchema, db: Session = Depends(get_db)):
        if account_id != payload.id:
            raise HTTPException(status_code=400, detail="Account id mismatch")
        return repository.save_account(db, payload)

    @app.delete("/api/accounts/{account_id}", response_model=StatusMessageSchema)
    def remove_account(account_id: str, db: Session = Depends(get_db)):
        repository.delete_account(db, account_id)
        return StatusMessageSchema(message="Account deleted")

    @app.get("/api/invoices", response_model=list[InvoiceSchema])
    def get_invoices(db: Session = Depends(get_db)):
        return repository.list_invoices(db)

    @app.put("/api/invoices/{invoice_id}", response_model=InvoiceSchema)
    def put_invoice(invoice_id: str, payload: InvoiceSchema, db: Session = Depends(get_db)):
        if invoice_id != payload.id:
            raise HTTPException(status_code=400, detail="Invoice id mismatch")
        return repository.save_invoice(db, payload)

    @app.delete("/api/invoices/{invoice_id}", response_model=StatusMessageSchema)
    def remove_invoice(invoice_id: str, db: Session = Depends(get_db)):
        repository.delete_invoice(db, invoice_id)
        return StatusMessageSchema(message="Invoice deleted")

    @app.get("/api/banks", response_model=list[BankOptionSchema])
    def get_banks(db: Session = Depends(get_db)):
        return repository.list_banks(db)

    @app.put("/api/banks/{bank_id}", response_model=BankOptionSchema)
    def put_bank(bank_id: str, payload: BankOptionSchema, db: Session = Depends(get_db)):
        if bank_id != payload.id:
            raise HTTPException(status_code=400, detail="Bank id mismatch")
        return repository.save_bank(db, payload)

    @app.delete("/api/banks/{bank_id}", response_model=StatusMessageSchema)
    def remove_bank(bank_id: str, db: Session = Depends(get_db)):
        repository.delete_bank(db, bank_id)
        return StatusMessageSchema(message="Bank deleted")

    @app.get("/api/documents/{guard_id}")
    def get_documents(guard_id: str, db: Session = Depends(get_db)):
        return repository.list_documents(db, guard_id)

    @app.post("/api/documents/upload", response_model=StatusMessageSchema)
    async def upload_documents(guardId: str = Form(...), guardName: str = Form(...), documentType: str = Form(...), files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
        saved = []
        for file in files:
            document = await store_document(guardId, guardName, documentType, file)
            repository.save_document(db, document)
            saved.append(document.model_dump())
        return StatusMessageSchema(message="Documents uploaded", data={"documents": saved})

    @app.get("/api/documents/download/{document_id}")
    def download_document(document_id: str, db: Session = Depends(get_db)):
        documents = repository.list_documents(db)
        match = next((doc for doc in documents if doc.id == document_id), None)
        if not match:
            raise HTTPException(status_code=404, detail="Document not found")
        file_path = PATHS.documents_dir / match.relativePath
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Stored file missing")
        return FileResponse(file_path, filename=match.originalName)

    @app.delete("/api/documents/{document_id}", response_model=StatusMessageSchema)
    def remove_document(document_id: str, db: Session = Depends(get_db)):
        documents = repository.list_documents(db)
        match = next((doc for doc in documents if doc.id == document_id), None)
        if match:
            file_path = PATHS.documents_dir / match.relativePath
            if file_path.exists():
                file_path.unlink()
        repository.delete_document(db, document_id)
        return StatusMessageSchema(message="Document deleted")

    @app.post("/api/export/pdf", response_model=StatusMessageSchema)
    def export_pdf(payload: PDFExportSchema, db: Session = Depends(get_db)):
        try:
            settings = repository.get_backup_settings(db)
            export_path = Path(settings.pdfExportPath or PATHS.exports_dir)
            export_path.mkdir(parents=True, exist_ok=True)
            
            file_path = export_path / payload.filename
            
            # Remove header if present (data:application/pdf;base64,...)
            b64_data = payload.base64
            if "," in b64_data:
                b64_data = b64_data.split(",")[1]
            
            with open(file_path, "wb") as f:
                f.write(base64.b64decode(b64_data))
                
            return StatusMessageSchema(message=f"PDF saved to {file_path}", data={"path": str(file_path)})
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save PDF: {str(e)}")

    if PATHS.frontend_dist.exists():
        app.mount("/", StaticFiles(directory=PATHS.frontend_dist, html=True), name="frontend")

    return app
