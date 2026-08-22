
import pytest
import asyncio
from fastapi import UploadFile, HTTPException
import io

from app.utils.file_validation import validate_file_magic_bytes

@pytest.mark.asyncio
async def test_magic_bytes_valid_csv():
    file_content = b"header1,header2\nval1,val2\n"
    file = UploadFile(filename="test.csv", file=io.BytesIO(file_content))
    # text/plain is used because python-magic might identify CSV as text/plain or text/csv
    content = await validate_file_magic_bytes(file, ["text/csv", "text/plain"])
    assert content == file_content

@pytest.mark.asyncio
async def test_magic_bytes_fake_csv():
    # PDF magic bytes in a CSV file
    file_content = b"%PDF-1.4 fake csv data"
    file = UploadFile(filename="test.csv", file=io.BytesIO(file_content))
    with pytest.raises(HTTPException) as excinfo:
        await validate_file_magic_bytes(file, ["text/csv", "text/plain"])
    assert excinfo.value.status_code == 415
    assert "Invalid file type" in excinfo.value.detail

@pytest.mark.asyncio
async def test_magic_bytes_valid_png():
    # PNG magic bytes
    file_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    file = UploadFile(filename="test.png", file=io.BytesIO(file_content))
    content = await validate_file_magic_bytes(file, ["image/png"])
    assert content == file_content

@pytest.mark.asyncio
async def test_magic_bytes_fake_png():
    # Fake PNG containing bash script
    file_content = b"#!/bin/bash\necho 'hello'"
    file = UploadFile(filename="test.png", file=io.BytesIO(file_content))
    with pytest.raises(HTTPException):
        await validate_file_magic_bytes(file, ["image/png"])

@pytest.mark.asyncio
async def test_magic_bytes_valid_jpeg():
    # JPEG magic bytes
    file_content = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01"
    file = UploadFile(filename="test.jpeg", file=io.BytesIO(file_content))
    content = await validate_file_magic_bytes(file, ["image/jpeg"])
    assert content == file_content

@pytest.mark.asyncio
async def test_magic_bytes_valid_pdf():
    # PDF magic bytes
    file_content = b"%PDF-1.4 \n..."
    file = UploadFile(filename="test.pdf", file=io.BytesIO(file_content))
    content = await validate_file_magic_bytes(file, ["application/pdf"])
    assert content == file_content

if __name__ == "__main__":
    pytest.main(["-v", __file__])
