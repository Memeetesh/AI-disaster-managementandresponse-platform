"""Local-disk evidence storage for the hackathon MVP.

Deliberately NOT S3/Supabase Storage: no extra credentials needed to run
the demo locally. The only contract that matters to callers is "give me a
file, get back a URL string" — swapping the backing store later means
changing only this module, not the API or the incident_evidence schema.
"""
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import settings

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".webm"}

_KIND_RULES = {
    "image": (ALLOWED_IMAGE_EXTENSIONS, "image/"),
    "audio": (ALLOWED_AUDIO_EXTENSIONS, "audio/"),
}


def _upload_root() -> Path:
    root = Path(settings.UPLOAD_DIR)
    root.mkdir(parents=True, exist_ok=True)
    return root


async def save_upload(file: UploadFile, *, kind: str) -> str:
    """Validates and streams an uploaded file to disk, returning its public URL path."""
    allowed_extensions, content_type_prefix = _KIND_RULES[kind]

    extension = Path(file.filename or "").suffix.lower()
    content_type_ok = bool(file.content_type) and file.content_type.startswith(content_type_prefix)
    if extension not in allowed_extensions or not content_type_ok:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported {kind} file type: {file.filename!r} ({file.content_type})",
        )

    subdir = _upload_root() / kind
    subdir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    destination = subdir / filename

    size = 0
    chunk_size = 1024 * 1024
    with destination.open("wb") as out:
        while chunk := await file.read(chunk_size):
            size += len(chunk)
            if size > settings.MAX_UPLOAD_BYTES:
                out.close()
                destination.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds the {settings.MAX_UPLOAD_BYTES // (1024 * 1024)}MB limit",
                )
            out.write(chunk)

    return f"/{settings.UPLOAD_DIR}/{kind}/{filename}"
