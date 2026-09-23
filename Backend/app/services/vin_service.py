import httpx

# TODO: Implement a caching mechanism to store the loaded model in memory for faster inference. This will reduce the overhead of loading the model from disk for each prediction request and improve the overall performance of the service.
# TODO: Implement the ability to handle multiple models for different vehicle types or maintenance tasks. This will allow the service to provide more accurate predictions based on the specific characteristics of the vehicle being analyzed.
# TODO: Ensure the API sends all data related to the car the user inputed.
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