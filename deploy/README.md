# Deploy MotorMate on the Ubuntu VM

## Prepare the VM

Install Ubuntu Server with OpenSSH, Git, Docker Engine, and the Compose plugin. Use the deployment branch in a clean checkout on the VM. The commands below run from the repository root. The Docker images use Node 22 and Python 3.13. Their first build needs access to the Node and Python registries and the font downloads used by Next.js.

```bash
cp deploy/compose.env.example deploy/compose.env
cp deploy/backend.env.example deploy/backend.env
chmod 600 deploy/compose.env deploy/backend.env
id -u
id -g
```

Set `MOTORMATE_UID` and `MOTORMATE_GID` to the VM user's values. Put the Firebase Admin JSON at the absolute path in `FIREBASE_SERVICE_ACCOUNT_FILE`. Own it as that user and set its permission to `600`. Compose mounts that file read-only in the backend. Set the frontend Firebase values for the same project as that key and use real Cloudinary public upload settings. Next.js builds the `NEXT_PUBLIC_*` values into the frontend.

Set the Atlas URI and exact database name in `deploy/backend.env`. For the first smoke test, use a separate test database and Firebase accounts. Atlas must allow the VM's outbound public IP, and the database user needs access to the chosen database. The example uses a test database name so existing data can stay in its current database.

[Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/) · [Atlas IP access list](https://www.mongodb.com/docs/atlas/security/ip-access-list/) · [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)

## Start and check the containers

```bash
docker compose --env-file deploy/compose.env -f docker-compose.production.yml config --quiet
docker compose --env-file deploy/compose.env -f docker-compose.production.yml up --build -d --wait
docker compose --env-file deploy/compose.env -f docker-compose.production.yml ps
curl -fsS http://127.0.0.1:8000/ready
curl -fsS http://127.0.0.1:3000/ -o /dev/null
```

`/health` reports liveness and the system status. `/ready` returns HTTP 503 until the backend can ping MongoDB and load the versioned model. Read `docker compose --env-file deploy/compose.env -f docker-compose.production.yml logs backend frontend` if either container fails readiness.

The published ports bind to VM loopback. From your computer, open an SSH tunnel and visit [http://localhost:3000](http://localhost:3000).

```bash
ssh -N -L 3000:127.0.0.1:3000 -L 8000:127.0.0.1:8000 YOUR_VM_USER@YOUR_VM_HOST
```

The loopback QR URL opens on the computer with the tunnel. For a phone scan, use a staging frontend and API the phone can reach. Generate a fresh QR link for the active rental stage after upgrading.

## Verify application flows

- Sign in with separate owner, borrower, customer, and mechanic test identities as needed. Check ToolDrop listing edits, handoff instructions, rental messages, extensions, and a customer booking a different user's mechanic.
- Check that anonymous calls return 401 and a different signed-in user cannot read or update the protected data. Verify the deployed Firestore rules for private account data with two test accounts.
- Upload a condition photo and confirm pickup or return. Check that expired, replayed, and wrong-stage links cannot submit and the recorded photo survives confirmation.
- Save a Maintenance questionnaire, run diagnostics, and reload the vehicle. Confirm the questionnaire settings and saved prediction are present.

The fixture-backed backend checks also run outside Docker after installing `Backend/requirements-runtime.txt`.

```bash
cd Backend
python -m unittest app.tests.test_deployment -v
```

The normal backend uses the committed two-input `maintenance-mlp-v1` NumPy release. It reads no MLflow tracking database. To reproduce the weights and run the parity check against the original PyTorch model, install the runtime dependencies and the matching PyTorch CPU build in a development environment. Run the exporter from `Backend`.

```bash
python -m pip install --index-url https://download.pytorch.org/whl/cpu torch==2.14.0
python scripts/export_cpu_model.py
```

## Cloudflare cutover

After the smoke test, set the public frontend and API HTTPS URLs in `deploy/compose.env`. Use the exact frontend origin in the backend's `CORS_ORIGINS`, authorize the frontend domain in Firebase Authentication, and rebuild the frontend. For example, use sibling hostnames such as `motormate.example.com` and `api-motormate.example.com`.

Run `cloudflared` on the VM and route the frontend and API hostnames to `http://127.0.0.1:3000` and `http://127.0.0.1:8000` respectively. Keep the API and `/handoff-upload/*` out of any Cloudflare cache rules and keep QR paths out of shared access logs. Retest sign-in, CORS, and a QR phone upload over the public HTTPS hostnames before handing out the URL.

[Cloudflare Tunnel setup](https://developers.cloudflare.com/tunnel/get-started/) · [Universal SSL coverage](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/)
