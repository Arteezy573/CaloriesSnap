# Azure App Service Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the CaloriesSnap FastAPI backend to Azure App Service with persistent SQLite storage and GitHub Actions CI/CD.

**Architecture:** Add gunicorn as production server, make the upload directory configurable via env var, create a startup script for Azure, and a GitHub Actions workflow for automated deployment. Then provision Azure resources via CLI.

**Tech Stack:** Azure App Service (Linux, Python 3.13), Azure Files, gunicorn, GitHub Actions

---

## File Map

### Create
- `backend/startup.sh` — gunicorn startup command for Azure
- `.github/workflows/deploy-backend.yml` — CI/CD pipeline

### Modify
- `backend/requirements.txt` — add `gunicorn`
- `backend/main.py:47` — make `UPLOAD_DIR` configurable via env var

---

## Task 1: Add Gunicorn & Make UPLOAD_DIR Configurable

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/main.py:47`

- [ ] **Step 1: Add gunicorn to requirements.txt**

Add this line to the end of `backend/requirements.txt`:

```
gunicorn==23.0.0
```

- [ ] **Step 2: Make UPLOAD_DIR read from environment**

In `backend/main.py`, change line 47 from:

```python
UPLOAD_DIR = Path("uploads")
```

to:

```python
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "uploads"))
```

- [ ] **Step 3: Install gunicorn locally to verify**

Run:
```bash
cd backend && pip install gunicorn==23.0.0
```

- [ ] **Step 4: Run tests to verify nothing broke**

Run:
```bash
cd backend && python -m pytest -v
```

Expected: All 51 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/main.py
git commit -m "feat: add gunicorn and make UPLOAD_DIR configurable for Azure"
```

---

## Task 2: Create Startup Script

**Files:**
- Create: `backend/startup.sh`

- [ ] **Step 1: Create startup.sh**

Create `backend/startup.sh`:

```bash
#!/bin/bash
gunicorn main:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --timeout 120
```

- [ ] **Step 2: Make it executable**

Run:
```bash
chmod +x backend/startup.sh
```

- [ ] **Step 3: Commit**

```bash
git add backend/startup.sh
git commit -m "feat: add gunicorn startup script for Azure App Service"
```

---

## Task 3: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/deploy-backend.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to Azure

on:
  push:
    branches: [master]
    paths:
      - 'backend/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.13'

      - name: Install dependencies
        working-directory: backend
        run: pip install -r requirements.txt

      - name: Run tests
        working-directory: backend
        run: python -m pytest -v

      - name: Create deployment package
        run: |
          cd backend
          zip -r ../deploy.zip . -x "tests/*" "__pycache__/*" "*.pyc" ".pytest_cache/*" "uploads/*" "*.db" "*.db-shm" "*.db-wal" ".env"

      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v3
        with:
          app-name: 'caloriessnap'
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: deploy.zip
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy-backend.yml
git commit -m "feat: add GitHub Actions workflow for Azure deployment"
```

---

## Task 4: Provision Azure Resources

This task is run once manually via Azure CLI. The user must have Azure CLI installed and be logged in (`az login`).

- [ ] **Step 1: Verify Azure CLI is installed and logged in**

Run:
```bash
az account show
```

Expected: Shows the user's subscription details. If not logged in, run `az login` first.

- [ ] **Step 2: Create resource group**

Run:
```bash
az group create --name caloriessnap-rg --location westus2
```

- [ ] **Step 3: Create storage account**

Run:
```bash
az storage account create \
  --name caloriessnapstore \
  --resource-group caloriessnap-rg \
  --location westus2 \
  --sku Standard_LRS
```

- [ ] **Step 4: Create file share**

Run:
```bash
az storage share-rm create \
  --storage-account caloriessnapstore \
  --name caloriessnap-data \
  --quota 1
```

- [ ] **Step 5: Create App Service plan**

Run:
```bash
az appservice plan create \
  --name caloriessnap-plan \
  --resource-group caloriessnap-rg \
  --location westus2 \
  --sku B1 \
  --is-linux
```

- [ ] **Step 6: Create the web app**

Run:
```bash
az webapp create \
  --name caloriessnap \
  --resource-group caloriessnap-rg \
  --plan caloriessnap-plan \
  --runtime "PYTHON:3.13"
```

- [ ] **Step 7: Mount the file share**

First, get the storage account key:
```bash
STORAGE_KEY=$(az storage account keys list \
  --account-name caloriessnapstore \
  --resource-group caloriessnap-rg \
  --query "[0].value" -o tsv)
```

Then mount it:
```bash
az webapp config storage-account add \
  --name caloriessnap \
  --resource-group caloriessnap-rg \
  --custom-id caloriessnap-data \
  --storage-type AzureFiles \
  --account-name caloriessnapstore \
  --share-name caloriessnap-data \
  --access-key "$STORAGE_KEY" \
  --mount-path /mnt/data
```

- [ ] **Step 8: Set app settings (environment variables)**

Generate a JWT secret first:
```bash
JWT_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")
```

Then set all app settings:
```bash
az webapp config appsettings set \
  --name caloriessnap \
  --resource-group caloriessnap-rg \
  --settings \
    ANTHROPIC_API_KEY="<your-anthropic-api-key>" \
    JWT_SECRET="$JWT_SECRET" \
    DB_PATH="/mnt/data/caloriessnap.db" \
    UPLOAD_DIR="/mnt/data/uploads" \
    SCM_DO_BUILD_DURING_DEPLOYMENT="true"
```

Replace `<your-anthropic-api-key>` with your actual Anthropic API key.

- [ ] **Step 9: Set the startup command**

Run:
```bash
az webapp config set \
  --name caloriessnap \
  --resource-group caloriessnap-rg \
  --startup-file startup.sh
```

- [ ] **Step 10: Download publish profile and add as GitHub secret**

Run:
```bash
az webapp deployment list-publishing-profiles \
  --name caloriessnap \
  --resource-group caloriessnap-rg \
  --xml > publish-profile.xml
```

Then:
1. Open `publish-profile.xml` and copy the entire contents
2. Go to your GitHub repo → Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
5. Value: paste the XML contents
6. Click "Add secret"
7. Delete the local file: `rm publish-profile.xml`

---

## Task 5: Deploy & Verify

- [ ] **Step 1: Push to master to trigger deployment**

Merge the feature branch into master and push, or push directly:
```bash
git push origin master
```

- [ ] **Step 2: Monitor deployment**

Check the GitHub Actions tab in your repo. The workflow should run, pass tests, and deploy.

- [ ] **Step 3: Verify the app is running**

Run:
```bash
curl https://caloriessnap.azurewebsites.net/api/register \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

Expected: 201 response with token and user object.

```bash
curl https://caloriessnap.azurewebsites.net/api/goals
```

Expected: 403 (no auth header — confirms auth is enforced).

- [ ] **Step 4: Update mobile .env**

Update `mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://caloriessnap.azurewebsites.net
```

- [ ] **Step 5: Commit the mobile URL update**

```bash
git add mobile/.env
git commit -m "feat: point mobile app to Azure backend"
```
