from __future__ import annotations

import hashlib
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from ..config import PATHS
from ..schemas import GuardDocumentSchema
from ..utils.files import sanitize_filename


# Utility used from utils.files


def _checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _folder_for(guard_name: str, document_type: str) -> Path:
    safe_guard = sanitize_filename(guard_name)
    safe_type = sanitize_filename(document_type)
    folder = PATHS.documents_dir / "guards" / safe_guard / safe_type
    folder.mkdir(parents=True, exist_ok=True)
    return folder


async def store_document(guard_id: str, guard_name: str, document_type: str, file: UploadFile) -> GuardDocumentSchema:
    content = await file.read()
    suffix = Path(file.filename or "").suffix
    
    # Create a readable stored name: GuardName_DocType_uuid.suffix
    safe_name = sanitize_filename(guard_name)
    safe_type = sanitize_filename(document_type)
    short_uuid = uuid4().hex[:8] 
    stored_name = f"{safe_name}_{safe_type}_{short_uuid}{suffix}"
    
    folder = _folder_for(guard_name, document_type)
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
