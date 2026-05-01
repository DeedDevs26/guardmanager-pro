from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path


def _runtime_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class AppPaths:
    runtime_root: Path
    app_data: Path
    database_file: Path
    documents_dir: Path
    backups_dir: Path
    tokens_dir: Path
    frontend_dist: Path
    google_credentials_default: Path
    exports_dir: Path


def get_paths() -> AppPaths:
    runtime_root = _runtime_root()
    # BUG FIX: Store data in a '.data' folder next to the .exe for portability.
    # This ensures data persists in the same place even if the user moves the app.
    app_data = Path(os.getenv("GUARDMANAGER_DATA_DIR", runtime_root / ".data"))

    # When bundled with PyInstaller (onefile mode), embedded data files are
    # extracted to a temp folder at sys._MEIPASS — NOT next to the .exe.
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        frontend_dist = Path(sys._MEIPASS) / "dist"
    else:
        frontend_dist = runtime_root / "dist"

    return AppPaths(
        runtime_root=runtime_root,
        app_data=app_data,
        database_file=app_data / "data" / "guardmanager.db",
        documents_dir=app_data / "data" / "documents",
        backups_dir=app_data / "backups",
        tokens_dir=app_data / "tokens",
        frontend_dist=frontend_dist,
        google_credentials_default=app_data / "google_credentials.json",
        exports_dir=app_data / "exports",
    )


PATHS = get_paths()


def ensure_directories() -> None:
    for path in (
        PATHS.app_data,
        PATHS.database_file.parent,
        PATHS.documents_dir,
        PATHS.backups_dir,
        PATHS.tokens_dir,
        PATHS.exports_dir,
    ):
        path.mkdir(parents=True, exist_ok=True)
