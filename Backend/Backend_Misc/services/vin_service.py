import httpx
from fastapi import HTTPException

NHTSA_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues"

async def decode_vin(vin: str) -> dict:
    if len(vin) != 17:
        raise HTTPException(status_code=400, detail="VIN must be exactly 17 characters.")

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{NHTSA_URL}/{vin}?format=json")
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to fetch data from NHTSA API.")

        data = response.json()
        results = data.get("Results", [])[0]

        # Checks if NHTSA returned an error code for the VIN
        if results.get("ErrorCode") and results.get("ErrorCode") != "0":
            raise HTTPException(status_code=400, detail=results.get("ErrorText", "Invalid VIN"))

        return {
            "vin": vin,
            "year": results.get("ModelYear"),
            "make": results.get("Make"),
            "model": results.get("Model"),
            "engine_displacement_l": results.get("DisplacementL"),
            "vehicle_type": results.get("VehicleType")
        }