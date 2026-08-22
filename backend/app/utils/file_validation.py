import magic
from fastapi import UploadFile, HTTPException, status

# Define allowed MIME types and their corresponding extensions
ALLOWED_MIME_TYPES = {
    "text/csv": ["csv"],
    "application/vnd.ms-excel": ["csv"],
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/gif": ["gif"],
    "application/pdf": ["pdf"],
    "application/zip": ["zip"],
    "text/plain": ["txt", "csv"]
}

async def validate_file_magic_bytes(file: UploadFile, allowed_types: list[str]) -> bytes:
    """
    Validates a file's magic bytes against a list of allowed MIME types.
    Returns the file content bytes if valid.
    Raises HTTPException if validation fails.
    """
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read file: {str(e)}"
        )

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty"
        )

    # Use python-magic to detect the actual MIME type from magic bytes
    try:
        mime = magic.Magic(mime=True)
        detected_mime_type = mime.from_buffer(content[:2048])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not validate file type: {str(e)}"
        )

    # Allow plain text if csv is allowed and detected type is plain text
    # (since CSVs often just show up as text/plain or application/csv)
    effective_allowed = set(allowed_types)
    if "text/csv" in allowed_types:
        effective_allowed.add("text/plain")
        effective_allowed.add("application/vnd.ms-excel")
        effective_allowed.add("application/csv")
        effective_allowed.add("text/x-csv")

    if detected_mime_type not in effective_allowed:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Invalid file type. Detected: {detected_mime_type}, Allowed: {', '.join(allowed_types)}"
        )

    return content
