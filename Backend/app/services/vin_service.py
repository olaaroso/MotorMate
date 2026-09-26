import asyncio

import httpx


class NHTSADecoder:
    def __init__(self):
        self.base_url = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/"
        self._cache = {}

    async def get_basic_info(self, vin: str) -> dict:
        normalized = vin.upper().strip()
        if normalized in self._cache:
            return self._cache[normalized]

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

        last_error = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    response = await client.get(f"{self.base_url}{normalized}?format=json", headers=headers)
                    response.raise_for_status()
                    data = response.json()
                    results = data.get("Results", [])
                    if not results:
                        payload = {"error": "No VIN decode results returned", "ErrorCode": "1"}
                        self._cache[normalized] = payload
                        return payload

                    payload = results[0]
                    self._cache[normalized] = payload
                    return payload
            except (httpx.HTTPError, ValueError, KeyError) as exc:
                last_error = exc
                if attempt < 2:
                    await asyncio.sleep(0.5 * (attempt + 1))

        return {"error": f"VIN decode failed after retries: {last_error}", "ErrorCode": "1"}


vin_decoder = NHTSADecoder()