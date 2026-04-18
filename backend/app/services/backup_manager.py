from __future__ import annotations

import shutil
from datetime import datetime

from sqlalchemy.orm import Session
from pathlib import Path

from ..config import PATHS
from ..database import close_engine
from ..schemas import BackupSettingsSchema
from . import repository
from .drive_backup import create_database_snapshot, upload_file_to_drive


def _backup_documents_copy() -> tuple[int, int]:
    stamp_dir = PATHS.backups_dir / f"documents-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    source = PATHS.documents_dir
    if not source.exists():
        return 0, 0
    shutil.copytree(source, stamp_dir, dirs_exist_ok=True)
    files = [p for p in stamp_dir.rglob("*") if p.is_file()]
    return len(files), sum(f.stat().st_size for f in files)


def cleanup_old_backups(keep_count: int = 10) -> None:
    """Keep only the N most recent local backups of DB and documents."""
    # 1. Database snapshots
    db_files = sorted(list(PATHS.backups_dir.glob("guardmanager-*.db")), key=lambda x: x.stat().st_mtime)
    if len(db_files) > keep_count:
        for f in db_files[:-keep_count]:
            try:
                f.unlink()
            except Exception:
                pass
    
    # 2. Document copies
    doc_dirs = sorted([d for d in PATHS.backups_dir.glob("documents-*") if d.is_dir()], key=lambda x: x.stat().st_mtime)
    if len(doc_dirs) > keep_count:
        for d in doc_dirs[:-keep_count]:
            try:
                shutil.rmtree(d)
            except Exception:
                pass


def restore_backup_bundle(backup_id: str) -> None:
    """Restores database and documents from a local backup folder/file."""
    stamp = backup_id 
    db_file = PATHS.backups_dir / f"guardmanager-{stamp}.db"
    doc_dir = PATHS.backups_dir / f"documents-{stamp}"
    
    if not db_file.exists():
        raise FileNotFoundError(f"Backup DB file not found: {db_file}")

    # 1. Restore Database
    # Close active engine to release file locks on Windows
    close_engine()
    
    # Remove WAL files if present to ensure clean swap
    for suffix in ["-wal", "-shm"]:
        extra = Path(str(PATHS.database_file) + suffix)
        if extra.exists():
            extra.unlink()

    shutil.copy2(db_file, PATHS.database_file)
    
    # 2. Restore Documents if present
    if doc_dir.exists():
        # Clear current documents
        if PATHS.documents_dir.exists():
            shutil.rmtree(PATHS.documents_dir)
        shutil.copytree(doc_dir, PATHS.documents_dir, dirs_exist_ok=True)


def import_database_file(file_path: str) -> None:
    """Safely replaces the current database with an external .db file."""
    source = Path(file_path)
    if not source.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    # Close active engine to release file locks on Windows
    close_engine()

    # Remove WAL files if present to ensure clean swap
    for suffix in ["-wal", "-shm"]:
        extra = Path(str(PATHS.database_file) + suffix)
        if extra.exists():
            extra.unlink()

    # Simple copy over active DB
    shutil.copy2(source, PATHS.database_file)


def run_backup(session: Session, settings: BackupSettingsSchema) -> list[repository.BackupRunSchema]:
    destination = "google_drive" if settings.driveEnabled else "local"
    run = repository.create_backup_run(session, destination=destination)
    files_uploaded = 0
    bytes_uploaded = 0

    try:
        folder_id = None
        if settings.driveEnabled:
            from .drive_backup import get_or_create_drive_folder
            folder_id = get_or_create_drive_folder(settings.googleDriveFolderName)

        if settings.includeDatabase:
            snapshot = create_database_snapshot()
            files_uploaded += 1
            bytes_uploaded += snapshot.stat().st_size
            if settings.driveEnabled:
                upload_file_to_drive(snapshot, folder_id=folder_id)

        if settings.includeDocuments:
            doc_files, doc_bytes = _backup_documents_copy()
            files_uploaded += doc_files
            bytes_uploaded += doc_bytes
            if settings.driveEnabled:
                for file_path in PATHS.documents_dir.rglob("*"):
                    if file_path.is_file():
                        upload_file_to_drive(file_path, folder_id=folder_id)

        repository.finish_backup_run(session, run.id, status="success", files_uploaded=files_uploaded, bytes_uploaded=bytes_uploaded)
        
        # Finally, clean up old local snapshots
        cleanup_old_backups(keep_count=10)
        
    except Exception as exc:
        repository.finish_backup_run(session, run.id, status="failed", error_message=str(exc), files_uploaded=files_uploaded, bytes_uploaded=bytes_uploaded)
        raise

    return repository.list_backup_runs(session)
