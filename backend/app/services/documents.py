from __future__ import annotations

import hashlib
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from ..config import PATHS
from ..schemas import GuardDocumentSchema


def _checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _folder_for(guard_id: str, document_type: str) -> Path:
    folder = PATHS.documents_dir / "guards" / guard_id / document_type
    folder.mkdir(parents=True, exist_ok=True)
    return folder


async def store_document(guard_id: str, document_type: str, file: UploadFile) -> GuardDocumentSchema:
    content = await file.read()
    suffix = Path(file.filename or "").suffix
    stored_name = f"{uuid4().hex}{suffix}"
    folder = _folder_for(guard_id, document_type)
    target = folder / stored_name
    target.write_bytes(content)
    relative = target.relative_to(PATHS.documents_dir).as_posix()
    return GuardDocumentSchema(
        id=uuid4().hex,
        guardId=guard_id,
        documentType=document_type,
        originalName=file.filename or stored_name,
        storedName=stored_name,
        relativePath=relative,
        mimeType=file.content_type or "",
        sizeBytes=len(content),
        checksumSha256=_checksum(content),
        createdAt=datetime.now().isoformat(),
    )
