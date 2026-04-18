from __future__ import annotations

import shutil
from datetime import datetime

from sqlalchemy.orm import Session

from ..config import PATHS
from ..schemas import BackupSettingsSchema
from . import repository
from .drive_backup import create_database_snapshot, upload_file_to_drive


def _backup_documents_copy() -> tuple[int, int]:
    stamp_dir = PATHS.backups_dir / f"documents-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
    source = PATHS.documents_dir
    if not source.exists():
        return 0, 0
    shutil.copytree(source, stamp_dir, dirs_exist_ok=True)
    files = [p for p in stamp_dir.rglob("*") if p.is_file()]
    return len(files), sum(f.stat().st_size for f in files)


def run_backup(session: Session, settings: BackupSettingsSchema) -> repository.BackupRunSchema:
    destination = "google_drive" if settings.driveEnabled else "local"
    run = repository.create_backup_run(session, destination=destination)
    files_uploaded = 0
    bytes_uploaded = 0

    try:
        if settings.includeDatabase:
            snapshot = create_database_snapshot()
            files_uploaded += 1
            bytes_uploaded += snapshot.stat().st_size
            if settings.driveEnabled:
                upload_file_to_drive(snapshot)

        if settings.includeDocuments:
            doc_files, doc_bytes = _backup_documents_copy()
            files_uploaded += doc_files
            bytes_uploaded += doc_bytes
            if settings.driveEnabled:
                for file_path in PATHS.documents_dir.rglob("*"):
                    if file_path.is_file():
                        upload_file_to_drive(file_path)

        repository.finish_backup_run(session, run.id, status="success", files_uploaded=files_uploaded, bytes_uploaded=bytes_uploaded)
    except Exception as exc:
        repository.finish_backup_run(session, run.id, status="failed", error_message=str(exc), files_uploaded=files_uploaded, bytes_uploaded=bytes_uploaded)
        raise

    return repository.list_backup_runs(session)[0]
