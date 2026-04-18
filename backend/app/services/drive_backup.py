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
    hour, minute = schedule_time.split(":")
    exe = PATHS.runtime_root / "GuardManagerPro.exe"
    target = exe if exe.exists() else Path(sys.executable)
    command = [
        "schtasks",
        "/Create",
        "/F",
        "/SC",
        "DAILY",
        "/TN",
        "GuardManagerProAutoBackup",
        "/TR",
        f'"{target.as_posix()}" --run-backup',
        "/ST",
        f"{hour}:{minute}",
    ]
    subprocess.run(" ".join(command), check=False, shell=True)


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


def get_or_create_drive_folder(folder_name: str) -> str:
    creds = load_credentials()
    if not creds:
        raise RuntimeError("Google Drive is not connected")
    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    
    # Search for existing folder
    query = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    response = service.files().list(q=query, fields="files(id, name)").execute()
    files = response.get("files", [])
    
    if files:
        return files[0]["id"]
    
    # Create new folder
    folder_metadata = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder"
    }
    file = service.files().create(body=folder_metadata, fields="id").execute()
    return file["id"]


def upload_file_to_drive(local_file: Path, folder_id: str | None = None) -> str:
    creds = load_credentials()
    if not creds:
        raise RuntimeError("Google Drive is not connected")
    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    metadata = {"name": local_file.name}
    if folder_id:
        metadata["parents"] = [folder_id]
    mime_type, _ = mimetypes.guess_type(local_file.as_posix())
    media = MediaFileUpload(local_file.as_posix(), mimetype=mime_type or "application/octet-stream", resumable=False)
    result = service.files().create(body=metadata, media_body=media, fields="id").execute()
    return result["id"]


def disconnect_google_drive() -> None:
    token_path = PATHS.tokens_dir / "google_token.json"
    if token_path.exists():
        token_path.unlink()
