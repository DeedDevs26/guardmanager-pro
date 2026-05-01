from __future__ import annotations

import mimetypes
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from ..config import PATHS
from ..schemas import DriveStatusSchema

SCOPES = ["https://www.googleapis.com/auth/drive.file"]


def create_database_snapshot() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = PATHS.backups_dir / f"guardmanager-{stamp}.db"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(PATHS.database_file, target)
    return target


def ensure_task_scheduler(schedule_time: str) -> None:
    """Creates or updates a Windows Scheduled Task for daily backups."""
    hour, minute = schedule_time.split(":")
    
    # Identify the correct entry point
    is_frozen = getattr(sys, "frozen", False)
    if is_frozen:
        # In production, run the bundled executable
        exe_path = PATHS.runtime_root / "GuardManagerPro.exe"
        if not exe_path.exists():
            exe_path = Path(sys.executable)
        task_command = str(exe_path.resolve()).replace("/", "\\")
        task_args = "--run-backup"
    else:
        # In development, run main.py via the current python interpreter
        python_exe = Path(sys.executable)
        main_py = (PATHS.runtime_root / "backend" / "main.py").resolve()
        task_command = str(python_exe).replace("/", "\\")
        task_args = f'"{str(main_py).replace("/", chr(92))}" --run-backup'


    # XML task definition — StartBoundary uses ISO 8601 which is always
    # locale-independent regardless of Windows regional settings.
    xml_content = f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>GuardManager Pro automatic daily backup</Description>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2024-01-01T{hour}:{minute}:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
    <Enabled>true</Enabled>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{task_command}</Command>
      <Arguments>{task_args}</Arguments>
    </Exec>
  </Actions>
</Task>"""

    xml_path = PATHS.app_data / "backup_task.xml"
    try:
        PATHS.app_data.mkdir(parents=True, exist_ok=True)
        xml_path.write_text(xml_content, encoding="utf-16")
        result = subprocess.run(
            ["schtasks", "/Create", "/F", "/TN", "GuardManagerProAutoBackup", "/XML", str(xml_path)],
            capture_output=True, text=True, check=False,
        )
        if result.returncode != 0:
            print(f"Task Scheduler Error: {result.stderr}")
    except Exception as e:
        print(f"Failed to register scheduled task: {e}")
    finally:
        try:
            if xml_path.exists():
                xml_path.unlink()
        except Exception:
            pass


def remove_task_scheduler() -> None:
    subprocess.run('schtasks /Delete /F /TN "GuardManagerProAutoBackup"', check=False, shell=True)


# Placeholder for Google OAuth Client Configuration.
# You will need to replace 'YOUR_CLIENT_ID' and 'YOUR_CLIENT_SECRET' with real values from Google Cloud Console.
GOOGLE_CLIENT_CONFIG = {
    "installed": {
        "client_id": "106856598146-q3s9esl65784n9c49tekdirkk0lr5du2.apps.googleusercontent.com",
        "project_id": "guardmanager-pro",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_secret": "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",
        "redirect_uris": ["http://localhost"]
    }
}


def connect_google_drive() -> DriveStatusSchema:
    if GOOGLE_CLIENT_CONFIG["installed"]["client_id"] == "YOUR_CLIENT_ID_HERE.apps.googleusercontent.com":
        raise ValueError("Google Drive is not configured. Please provide a valid Client ID and Secret in drive_backup.py.")

    flow = InstalledAppFlow.from_client_config(GOOGLE_CLIENT_CONFIG, SCOPES)
    creds = flow.run_local_server(port=0, open_browser=True)
    
    token_path = PATHS.tokens_dir / "google_token.json"
    PATHS.tokens_dir.mkdir(parents=True, exist_ok=True)
    token_path.write_text(creds.to_json(), encoding="utf-8")
    return DriveStatusSchema(connected=True, folderName="GuardManager Pro")


def load_credentials() -> Credentials | None:
    token_path = PATHS.tokens_dir / "google_token.json"
    if not token_path.exists():
        return None
    return Credentials.from_authorized_user_file(token_path.as_posix(), SCOPES)


def get_or_create_drive_folder(folder_name: str, parent_id: str | None = None) -> str:
    creds = load_credentials()
    if not creds:
        raise RuntimeError("Google Drive is not connected")
    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    
    # Search for existing folder
    query = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    if parent_id:
        query += f" and '{parent_id}' in parents"
    
    response = service.files().list(q=query, fields="files(id, name)").execute()
    files = response.get("files", [])
    
    if files:
        return files[0]["id"]
    
    # Create new folder
    folder_metadata = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder"
    }
    if parent_id:
        folder_metadata["parents"] = [parent_id]
        
    file = service.files().create(body=folder_metadata, fields="id").execute()
    return file["id"]


def get_or_create_drive_path(folder_path: list[str], root_folder_id: str) -> str:
    """Recursively nested folder creation from a path list."""
    current_parent = root_folder_id
    for part in folder_path:
        current_parent = get_or_create_drive_folder(part, parent_id=current_parent)
    return current_parent


def upload_file_to_drive(local_file: Path, folder_id: str | None = None) -> str:
    creds = load_credentials()
    if not creds:
        raise RuntimeError("Google Drive is not connected")
    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    
    # Check for existing file with same name and same parent
    query = f"name = '{local_file.name}' and trashed = false"
    if folder_id:
        query += f" and '{folder_id}' in parents"
    
    response = service.files().list(q=query, fields="files(id, name)").execute()
    existing_files = response.get("files", [])

    metadata = {"name": local_file.name}
    if folder_id:
        metadata["parents"] = [folder_id]
    
    mime_type, _ = mimetypes.guess_type(local_file.as_posix())
    media = MediaFileUpload(local_file.as_posix(), mimetype=mime_type or "application/octet-stream", resumable=False)
    
    if existing_files:
        # Update existing file
        file_id = existing_files[0]["id"]
        result = service.files().update(fileId=file_id, media_body=media).execute()
        return result["id"]
    else:
        # Create new file
        result = service.files().create(body=metadata, media_body=media, fields="id").execute()
        return result["id"]


def cleanup_old_drive_backups(folder_id: str, keep_count: int = 10) -> None:
    """Keep only the latest N database backups on Google Drive."""
    creds = load_credentials()
    if not creds:
        return
    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    
    # List guardmanager-*.db files in the root backup folder
    query = f"name contains 'guardmanager-' and name contains '.db' and '{folder_id}' in parents and trashed = false"
    response = service.files().list(q=query, fields="files(id, name, createdTime)", orderBy="name desc").execute()
    files = response.get("files", [])
    
    if len(files) > keep_count:
        for f in files[keep_count:]:
            try:
                service.files().delete(fileId=f["id"]).execute()
            except Exception as e:
                print(f"Failed to delete old Drive backup {f['name']}: {e}")


def disconnect_google_drive() -> None:
    token_path = PATHS.tokens_dir / "google_token.json"
    if token_path.exists():
        token_path.unlink()
