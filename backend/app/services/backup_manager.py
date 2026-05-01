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




def cleanup_old_backups(keep_count: int = 10) -> None:
    """Keep only the N most recent local backups of DB."""
    # 1. Database snapshots
    db_files = sorted(list(PATHS.backups_dir.glob("guardmanager-*.db")), key=lambda x: x.stat().st_mtime)
    if len(db_files) > keep_count:
        for f in db_files[:-keep_count]:
            try:
                f.unlink()
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

    # BUG-03 fix: dispose engine again after the file swap so the connection
    # pool discards any stale state and reconnects to the restored DB file.
    from ..database import engine
    engine.dispose()
    
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


def run_backup(session: Session, settings: BackupSettingsSchema, is_automatic: bool = False) -> list[repository.BackupRunSchema]:
    destination = "google_drive" if settings.driveEnabled else "local"
    run = repository.create_backup_run(session, destination=destination, is_automatic=is_automatic)
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
                from .drive_backup import cleanup_old_drive_backups
                upload_file_to_drive(snapshot, folder_id=folder_id)
                cleanup_old_drive_backups(folder_id, keep_count=10)

        if settings.includeDocuments:
            if settings.driveEnabled:
                from .drive_backup import get_or_create_drive_path
                # We use the database to find documents and their guard names
                docs_with_info = repository.list_documents_with_names(session)
                for doc, guard_name in docs_with_info:
                    local_path = PATHS.documents_dir / doc.relative_path
                    if local_path.exists():
                        # Determine Drive folder: Guards / GuardName / DocType
                        from .documents import _sanitize_name
                        parts = ["guards", _sanitize_name(guard_name), _sanitize_name(doc.document_type)]
                        target_folder_id = get_or_create_drive_path(parts, folder_id)
                        upload_file_to_drive(local_path, folder_id=target_folder_id)
                        
                        # Update stats
                        files_uploaded += 1
                        bytes_uploaded += doc.size_bytes

        repository.finish_backup_run(session, run.id, status="success", files_uploaded=files_uploaded, bytes_uploaded=bytes_uploaded)
        
        # Finally, clean up old local snapshots
        cleanup_old_backups(keep_count=10)
        
    except Exception as exc:
        repository.finish_backup_run(session, run.id, status="failed", error_message=str(exc), files_uploaded=files_uploaded, bytes_uploaded=bytes_uploaded)
        raise

    return repository.list_backup_runs(session)
