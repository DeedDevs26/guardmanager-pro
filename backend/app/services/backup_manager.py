from __future__ import annotations

import shutil
import time
from datetime import datetime

from sqlalchemy.orm import Session
from pathlib import Path

from ..config import PATHS
from ..database import close_engine
from ..schemas import BackupSettingsSchema
from . import repository
from .drive_backup import create_database_snapshot, upload_file_to_drive


def log_message(msg: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{timestamp}] {msg}\n"
    print(formatted.strip())
    try:
        PATHS.log_file.parent.mkdir(parents=True, exist_ok=True)
        with open(PATHS.log_file, "a", encoding="utf-8") as f:
            f.write(formatted)
    except Exception as e:
        print(f"FAILED TO WRITE LOG: {e}")


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

    # BUG-03 fix: completely re-initialize the connection engine post-swap
    # so the connection pool discards stale state, and ensure tables and defaults.
    from ..database import Base, engine, reinit_database, session_scope
    from . import repository
    reinit_database()
    
    # Ensure tables exist and seed defaults
    try:
        Base.metadata.create_all(bind=engine)
        with session_scope() as session:
            repository.seed_defaults(session)
        log_message("Database schemas and defaults initialized post-restore.")
    except Exception as e:
        log_message(f"WARN: Post-restore database initialization failed: {e}")
    
    # 2. Restore Documents if present
    if doc_dir.exists():
        # Clear current documents
        if PATHS.documents_dir.exists():
            shutil.rmtree(PATHS.documents_dir)
        shutil.copytree(doc_dir, PATHS.documents_dir, dirs_exist_ok=True)


def import_database_file(file_path: str) -> None:
    """Safely replaces the current database with an external .db file.
    Uses retries and temporary files to handle Windows file locking issues.
    """
    source = Path(file_path)
    if not source.exists():
        log_message(f"ERROR: Import source not found: {file_path}")
        raise FileNotFoundError(f"File not found: {file_path}")
    
    log_message(f"START: Importing {file_path}...")
    
    # Close active engine to release file locks
    try:
        close_engine()
        log_message("Engine closed.")
    except Exception as e:
        log_message(f"WARN: Failed to close engine cleanly: {e}")
    
    # 1. Clean up WAL/SHM files
    for suffix in ["-wal", "-shm"]:
        extra = Path(str(PATHS.database_file) + suffix)
        if extra.exists():
            for i in range(5):
                try:
                    extra.unlink()
                    log_message(f"Deleted {extra.name}")
                    break
                except PermissionError:
                    log_message(f"LOCKED: {extra.name} locked, retry {i+1}/5...")
                    time.sleep(0.5)
                except Exception as e:
                    log_message(f"ERROR: Failed to delete {extra.name}: {e}")
                    break

    # 2. Swap database file
    temp_db = PATHS.database_file.with_suffix(".tmp")
    try:
        shutil.copy2(source, temp_db)
        log_message(f"Copied source to temp: {temp_db.name}")
        
        success = False
        last_error = None
        for i in range(10):
            try:
                if PATHS.database_file.exists():
                    PATHS.database_file.unlink()
                    log_message("Active DB file unlinked.")
                
                temp_db.rename(PATHS.database_file)
                success = True
                log_message("SUCCESS: Database file swapped.")
                break
            except PermissionError as e:
                last_error = e
                log_message(f"LOCKED: Active DB locked, retry {i+1}/10... ({e})")
                time.sleep(0.5)
            except Exception as e:
                last_error = e
                log_message(f"ERROR: Swap failed: {e}")
                break
        
        if not success:
            log_message(f"CRITICAL: All swap retries failed. Last error: {last_error}")
            raise last_error or Exception("Failed to swap database file after multiple retries.")

    finally:
        if temp_db.exists():
            try:
                temp_db.unlink()
            except:
                pass

    # 3. Re-initialize engine and ensure schemas/defaults
    try:
        from ..database import Base, engine, reinit_database, session_scope
        from . import repository
        reinit_database()
        log_message("Engine re-initialized successfully.")
        
        # Ensure tables exist and seed defaults
        Base.metadata.create_all(bind=engine)
        with session_scope() as session:
            repository.seed_defaults(session)
        log_message("Database schemas and defaults initialized post-import.")
    except Exception as e:
        log_message(f"WARN: Engine re-initialization/setup failed: {e}")
        
    log_message("FINISH: Import complete.")


def run_backup(session: Session, settings: BackupSettingsSchema, is_automatic: bool = False) -> list[repository.BackupRunSchema]:
    now = datetime.now()
    started_at = now.isoformat()
    
    destination = "google_drive" if settings.driveEnabled else "local"
    run = repository.create_backup_run(session, destination=destination, is_automatic=is_automatic, started_at=started_at)
    files_uploaded = 0
    bytes_uploaded = 0

    try:
        folder_id = None
        if settings.driveEnabled:
            from .drive_backup import get_or_create_drive_folder
            folder_id = get_or_create_drive_folder(settings.googleDriveFolderName)

        if settings.includeDatabase:
            snapshot = create_database_snapshot(timestamp=now)
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
                        from ..utils.files import sanitize_filename
                        parts = ["guards", sanitize_filename(guard_name), sanitize_filename(doc.document_type)]
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
