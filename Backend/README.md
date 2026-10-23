# MotorMate Backend

FastAPI service for MotorMate vehicle registration, service history, mechanic search, and maintenance predictions. The API uses MongoDB for application data and MLflow for the trained PyTorch maintenance model.

## Requirements

- Python 3.10 or newer
- MongoDB available at the configured `MONGODB_URL`
- Packages listed in `requirements.txt`

## Install and Run

From the `Backend` directory, create and activate a virtual environment, then install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in `Backend/` if the defaults do not match your local setup:

```dotenv
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=car_repair_db
```

Start MongoDB, then run the development API server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Alternatively, `python run.py` starts the same development server. The API is available at `http://localhost:8000`; interactive Swagger documentation is at `http://localhost:8000/docs`, and `/health` reports API and database status.

The application attempts to connect to MongoDB during startup. If the database is unavailable, the API still starts, but database-backed endpoints return an error until the connection is restored.

## Configuration

Settings are loaded from `Backend/.env` and can also be provided as environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONGODB_URL` | `mongodb://localhost:27017` | MongoDB connection string |
| `DATABASE_NAME` | `car_repair_db` | MongoDB database used by the API |
| `NOMINATIM_USER_AGENT` | `MotorMate/1.0` | Identifies the app to Nominatim; configure a contact address for production |

`PROJECT_NAME` is defined in the settings class but is not currently used to set the FastAPI title. CORS currently allows the local frontend origins `http://localhost:3000` and `http://127.0.0.1:3000`.

## Main API Routes

| Route | Purpose |
| --- | --- |
| `GET /health` | API and database status |
| `/api/auth` | User registration and authentication |
| `/api/vin` | VIN lookup, vehicle registration, and vehicle management |
| `/api/service-history` | Create, list, update, and delete service records |
| `/api/predict/` | Predict maintenance from a VIN and mileage |
| `/api/predict/vehicle/{vehicle_id}` | Generate or retrieve a prediction for an owned, registered vehicle |
| `/api/mechanics` | Mechanic registration and search |
| `GET /api/location/nearest-mechanics` | Geocode an address and find nearby mechanic shops |
| `/api/diy` | DIY tool-related routes |

See `/docs` for the complete request and response schemas.

## Nearby Mechanic Search

The location API sends the supplied address to OpenStreetMap's Nominatim service for lookup. Set `NOMINATIM_USER_AGENT` to an identifying application name and contact address before production use, and follow the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/). The public service is rate-limited and is not intended for autocomplete or high-volume workloads. Responses include OpenStreetMap attribution.

Mechanic registration geocodes the shop address and saves a GeoJSON point when lookup succeeds. Existing shop profiles gain coordinates the next time they are saved. Authenticated consumers and DIY users can search by address:

```bash
curl 'http://localhost:8000/api/location/nearest-mechanics?address=11735&radius_km=25&service_needed=Brake%20Pads' \
	-H 'Authorization: Bearer ACCESS_TOKEN'
```

The endpoint accepts an address or postal code, an optional `radius_km` (up to 250), an optional `service_needed`, and a result `limit`. Results are ordered by distance and contain shop addresses and distance in kilometers.

### Frontend Example

Set `NEXT_PUBLIC_API_URL` to the backend origin, such as `http://localhost:8000`. The location endpoint requires a Bearer token issued by this backend's `/api/auth/register` or `/api/auth/login` route. Pass the customer-entered address as a URL-encoded query parameter:

```ts
const params = new URLSearchParams({
	address: customerAddress,
	radius_km: "25",
	service_needed: "Brake Pads",
});

const response = await fetch(
	`${apiUrl}/api/location/nearest-mechanics?${params}`,
	{ headers: { Authorization: `Bearer ${accessToken}` } }
);

if (!response.ok) throw new Error("Nearby mechanic search failed");

const data = await response.json();
// data.results: { mechanic_id, shop_name, address, services,
//                 price_per_hour, distance_km }[]
```

Render each `data.results` item as a shop result, showing its distance and address. Handle an empty array as “No nearby mechanics found.” The response also contains the geocoded origin and OpenStreetMap attribution; show the attribution alongside location results.

## Maintenance Predictions

The prediction endpoint decodes the VIN through the NHTSA vPIC service, then runs the latest model logged to the `Vehicle_Maintenance_Prediction` MLflow experiment. The current model inputs are vehicle year, mileage, and a driving-severity value derived from driving habits. Results include repair names, likelihoods, estimated costs, model version, and generation time.

For a VIN prediction without saving it to a registered vehicle:

```bash
curl -X POST http://localhost:8000/api/predict/ \
	-H 'Content-Type: application/json' \
	-d '{"vin":"1HGCM82633A000000","mileage":80000,"driving_habits":"Mixed"}'
```

To generate and save a prediction for a registered vehicle, provide the vehicle's MongoDB ID and owner ID. Mileage is optional; if omitted, the vehicle's saved current mileage is used:

```bash
curl -X POST http://localhost:8000/api/predict/vehicle/VEHICLE_ID \
	-H 'Content-Type: application/json' \
	-d '{"owner_id":"OWNER_ID","mileage":80000}'
```

The API stores a `maintenance_model_profile` and the latest `maintenance_prediction` on that vehicle document. Retrieve the saved values with:

```bash
curl 'http://localhost:8000/api/predict/vehicle/VEHICLE_ID?owner_id=OWNER_ID'
```

The prediction response keeps the `upcoming_repairs` list for direct display and also includes a `prediction` snapshot for registered vehicles. The VIN endpoint only associates and saves a prediction when `owner_id` is provided and matches a registered VIN.

### Frontend Example

For a saved vehicle, call the registered-vehicle route. The backend uses saved mileage when `mileage` is omitted, runs inference, saves the latest snapshot, and returns it in `upcoming_repairs` and `prediction.upcoming_repairs`:

```ts
const response = await fetch(
	`${apiUrl}/api/predict/vehicle/${vehicleId}`,
	{
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ owner_id: ownerId, mileage: currentMileage }),
	}
);

if (!response.ok) throw new Error("Prediction unavailable");

const data = await response.json();
const repairs = data.upcoming_repairs ?? [];
```

For a vehicle that is not saved in the customer's garage, call `POST /api/predict/` with `{ vin, mileage, driving_habits }`; that route returns predictions without saving them unless a matching `owner_id` is also supplied. Both endpoints return repair items with `part`, `probability` (0 to 1), and `estimated_cost`. Render all returned items, convert probability to a percentage for display, and handle `None expected soon` separately from repair items. Show loading, empty, and error states rather than treating a failed request as “no problems.”

The current model is trained on synthetic maintenance examples, uses vehicle year, mileage, and driving severity, and returns only items above a 0.50 threshold. Costs are fixed estimates, not shop quotes. Describe results as possible maintenance needs, not confirmed defects or a diagnosis. The registered-vehicle routes currently identify ownership using the supplied `owner_id`; do not treat that value as verified authorization until backend authentication checks are added.

## Training and MLflow

`app/ml_pipeline/tracking.py` trains the model used by the prediction API and logs it to MLflow. Run it from `Backend/`:

```bash
python app/ml_pipeline/tracking.py
```

Training generates 20,000 seeded synthetic examples, holds out 20% for validation, and logs training and validation loss. The MLflow SQLite database is stored at `Backend/mlflow.db`; inference loads the latest logged model and caches it for the lifetime of the API process. Restart the API after training so it loads the newly logged model.

`app/ml_pipeline/train.py` is a separate checkpoint training script:

```bash
python app/ml_pipeline/train.py
```

It writes `app/ml_pipeline/models/repair_predictor_v2.pth`; the API currently loads MLflow models, not this standalone checkpoint. Training sample count can be changed through `generate_synthetic_data(num_samples=...)` or `train_model(num_samples=...)`. Model dimensions, epoch count, batch size, learning rate, and early-stopping patience are configured in the training scripts.

The current labels are synthetic maintenance heuristics, not observed repair outcomes. Larger simulations improve coverage of those generated patterns, but they do not establish real-world prediction accuracy. The per-vehicle model profile records that vehicle's inputs and model version; it is not a separately trained set of neural-network weights for each vehicle.

## Tests

From `Backend/`, run the test suite with:

```bash
pytest
```

Several API tests connect to MongoDB and require a reachable test database. The VIN decoding integration tests may also require an internet connection to NHTSA.
