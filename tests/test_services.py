import pytest
from services.vin_service import decode_vin
from fastapi import HTTPException

@pytest.mark.asyncio
async def test_invalid_vin_length():
    with pytest.raises(HTTPException) as excinfo:
        await decode_vin("SHORTVIN123")
    assert excinfo.value.status_code == 400