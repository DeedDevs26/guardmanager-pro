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


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def run_server(port: int) -> None:
    uvicorn.run(create_app(), host="127.0.0.1", port=port, log_level="info")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-backup", action="store_true")
    parser.add_argument("--open-browser", action="store_true")
    args = parser.parse_args()

    if args.run_backup:
        with session_scope() as session:
            backup_manager.run_backup(session, repository.get_backup_settings(session))
        return

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

    webview.create_window("GuardManager Pro", base_url, width=1280, height=860, min_size=(1100, 720))
    webview.start(private_mode=False)


if __name__ == "__main__":
    main()
