from __future__ import annotations

import hashlib
import re
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from ..config import PATHS
from ..schemas import GuardDocumentSchema


def _sanitize_name(name: str) -> str:
    """Removes non-alphanumeric characters and replaces spaces with underscores."""
    return re.sub(r'[^a-zA-Z0-9]', '_', name).strip('_')


def _checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _folder_for(guard_id: str, document_type: str) -> Path:
    folder = PATHS.documents_dir / "guards" / guard_id / document_type
    folder.mkdir(parents=True, exist_ok=True)
    return folder


async def store_document(guard_id: str, guard_name: str, document_type: str, file: UploadFile) -> GuardDocumentSchema:
    content = await file.read()
    suffix = Path(file.filename or "").suffix
    
    # Create a readable stored name: GuardName_DocType_uuid.suffix
    safe_name = _sanitize_name(guard_name)
    safe_type = _sanitize_name(document_type)
    short_uuid = uuid4().hex[:8] 
    stored_name = f"{safe_name}_{safe_type}_{short_uuid}{suffix}"
    
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
