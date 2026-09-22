import httpx

class NHTSADecoder:
    def __init__(self):
        # DecodeVinValues returns a cleaner, flatter JSON structure
        self.base_url = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/"

    async def get_basic_info(self, vin: str) -> dict:
        # Government APIs often block default Python HTTP clients. 
        # This header masks the request as a standard web browser.
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{self.base_url}{vin}?format=json", headers=headers)
                response.raise_for_status()
                
                data = response.json()
                results = data.get("Results", [])
                
                if not results:
                    return {"error": "No results returned", "ErrorCode": "1"}
                    
                return results[0]
                
            except Exception as e:
                return {"error": str(e), "ErrorCode": "1"}

vin_decoder = NHTSADecoder()