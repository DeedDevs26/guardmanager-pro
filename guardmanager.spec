# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

project_root = Path(SPEC).resolve().parent

datas = [(str(project_root / "dist"), "dist")]

a = Analysis(
    ["backend/main.py"],
    pathex=[str(project_root / "backend")],
    binaries=[],
    datas=datas,
    hiddenimports=[
        # uvicorn internals
        "uvicorn.logging",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        # SQLAlchemy dialects
        "sqlalchemy.dialects.sqlite",
        "sqlalchemy.dialects.sqlite.pysqlite",
        # pywebview
        "webview",
        "webview.platforms.winforms",
        # FastAPI / starlette
        "starlette.routing",
        "starlette.staticfiles",
        "starlette.responses",
        "anyio",
        "anyio.lowlevel",
        # multipart
        "multipart",
        # jaraco & backports (required by setuptools/pkg_resources at runtime)
        "backports",
        "backports.tarfile",
        "jaraco.context",
        "jaraco.text",
        "jaraco.functools",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="GuardManagerPro",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
)
