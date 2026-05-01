from __future__ import annotations

import argparse
import os
import socket
import threading
import time
import webbrowser

import uvicorn
import webview

from app.api import create_app
from app.database import session_scope
from app.services import backup_manager, repository
from app.services.drive_backup import ensure_task_scheduler, remove_task_scheduler


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class Bridge:
    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    def pick_folder(self):
        if not self._window:
            return None
        result = self._window.create_file_dialog(webview.FOLDER_DIALOG)
        return result[0] if result else None

    def pick_file(self):
        if not self._window:
            return None
        result = self._window.create_file_dialog(webview.OPEN_DIALOG, file_types=('Data Base Files (*.db)', 'All files (*.*)'))
        return result[0] if result else None

    def open_folder(self, folder_path: str):
        if not folder_path:
            return
        import platform
        import subprocess
        path = os.path.normpath(folder_path)
        if not os.path.exists(path):
            return
            
        if platform.system() == 'Windows':
            os.startfile(path)
        elif platform.system() == 'Darwin':
            subprocess.Popen(['open', path])
        else:
            subprocess.Popen(['xdg-open', path])


def _sync_scheduler_on_startup() -> None:
    """Re-register (or remove) the Windows Task Scheduler entry based on the
    saved backup settings.  Runs every launch so the task is always present
    on any device without requiring the user to re-save settings manually."""
    try:
        with session_scope() as session:
            settings = repository.get_backup_settings(session)
        if settings.autoBackupEnabled and settings.backupTime:
            ensure_task_scheduler(settings.backupTime)
        else:
            remove_task_scheduler()
    except Exception as exc:
        # Non-fatal – app should still start even if scheduler sync fails
        print(f"[startup] Scheduler sync skipped: {exc}")


def run_server(port: int) -> None:
    uvicorn.run(create_app(), host="127.0.0.1", port=port, log_level="info")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-backup", action="store_true")
    parser.add_argument("--open-browser", action="store_true")
    args = parser.parse_args()

    if args.run_backup:
        with session_scope() as session:
            backup_manager.run_backup(session, repository.get_backup_settings(session), is_automatic=True)
        return

    # Ensure the scheduled task is correctly registered on this machine
    _sync_scheduler_on_startup()

    port = int(os.getenv("GUARDMANAGER_PORT", _free_port()))
    server_thread = threading.Thread(target=run_server, args=(port,), daemon=True)
    server_thread.start()
    base_url = f"http://127.0.0.1:{port}"

    for _ in range(60):
        try:
            socket.create_connection(("127.0.0.1", port), timeout=0.25).close()
            break
        except OSError:
            time.sleep(0.25)

    if args.open_browser:
        webbrowser.open(base_url)
        server_thread.join()
        return

    bridge = Bridge()
    window = webview.create_window("GuardManager Pro", base_url, width=1280, height=860, min_size=(1100, 720), js_api=bridge)
    bridge.set_window(window)
    webview.start(private_mode=False)


if __name__ == "__main__":
    main()
