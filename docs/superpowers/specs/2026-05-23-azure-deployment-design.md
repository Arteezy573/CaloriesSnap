# Azure App Service Deployment

## Overview

Deploy the CaloriesSnap FastAPI backend to Azure App Service (Linux, Python 3.13) with SQLite persisted on an Azure Files share. CI/CD via GitHub Actions on push to `master`.

## Azure Resources

All in **West US 2** region.

| Resource | Name | Purpose |
|----------|------|---------|
| Resource Group | `caloriessnap-rg` | Container for all resources |
| App Service Plan | `caloriessnap-plan` (B1 Linux) | Hosts the web app (~$13/month) |
| Web App | `caloriessnap` (Python 3.13) | Runs the FastAPI backend |
| Storage Account | `caloriessnapstore` | Hosts Azure Files share |
| File Share | `caloriessnap-data` | Mounted at `/mnt/data` for SQLite + uploads |

## Persistent Storage

Azure Files share mounted into the App Service container at `/mnt/data`. Contains:
- `/mnt/data/caloriessnap.db` — SQLite database (WAL mode)
- `/mnt/data/uploads/` — uploaded food images

This survives container restarts, deployments, and scale operations.

## App Settings (Environment Variables)

| Setting | Value |
|---------|-------|
| `ANTHROPIC_API_KEY` | User's Claude API key |
| `JWT_SECRET` | Secure random string (generate with `python -c "import secrets; print(secrets.token_hex(32))"`) |
| `DB_PATH` | `/mnt/data/caloriessnap.db` |
| `UPLOAD_DIR` | `/mnt/data/uploads` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` |

## Startup

Gunicorn with uvicorn workers:

```
gunicorn main:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

Configured via `backend/startup.sh`.

## CI/CD

GitHub Actions workflow `.github/workflows/deploy-backend.yml`:
- Triggers on push to `master` (paths: `backend/**`)
- Sets up Python 3.13, installs dependencies
- Zips the backend directory
- Deploys via `azure/webapps-deploy` action
- Requires GitHub secret `AZURE_WEBAPP_PUBLISH_PROFILE` containing the App Service publish profile

## Files to Create

- `backend/startup.sh` — gunicorn startup command
- `.github/workflows/deploy-backend.yml` — CI/CD pipeline

## Files to Modify

- `backend/requirements.txt` — add `gunicorn`
- `backend/main.py` — read `UPLOAD_DIR` from env var so uploads persist to mounted storage

## Code Changes

### main.py

The `UPLOAD_DIR` is currently hardcoded to `Path("uploads")`. Change to read from environment:

```python
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "uploads"))
```

This way local dev still uses `./uploads` but Azure uses `/mnt/data/uploads`.

### requirements.txt

Add:
```
gunicorn==23.0.0
```

## Azure Setup Steps (Manual, One-Time)

These are run once via Azure CLI to provision resources:

1. Create resource group
2. Create storage account and file share
3. Create App Service plan (B1 Linux)
4. Create web app (Python 3.13)
5. Mount file share to `/mnt/data`
6. Set app settings (env vars)
7. Configure startup command
8. Download publish profile, add as GitHub secret

## Post-Deployment

Update `mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://caloriessnap.azurewebsites.net
```

## What Does Not Change

- Database schema and queries
- Auth module
- Analyzer logic
- Mobile app code (except the API URL env var)
- Local development workflow
