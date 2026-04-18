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
    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
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


def connect_google_drive(credentials_path: str) -> DriveStatusSchema:
    credentials_file = Path(credentials_path)
    if not credentials_file.exists():
        raise FileNotFoundError(f"Google credentials file not found: {credentials_file}")
    flow = InstalledAppFlow.from_client_secrets_file(credentials_file.as_posix(), SCOPES)
    creds = flow.run_local_server(port=0)
    token_path = PATHS.tokens_dir / "google_token.json"
    token_path.write_text(creds.to_json(), encoding="utf-8")
    return DriveStatusSchema(connected=True, credentialsPath=credentials_file.as_posix(), folderName="GuardManager Pro")


def load_credentials() -> Credentials | None:
    token_path = PATHS.tokens_dir / "google_token.json"
    if not token_path.exists():
        return None
    return Credentials.from_authorized_user_file(token_path.as_posix(), SCOPES)


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
