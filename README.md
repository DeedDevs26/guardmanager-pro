<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# GuardManager Pro

Desktop guard management application with the existing React frontend migrated to a local Python runtime.

## Stack

- Frontend: React + TypeScript + Vite
- Desktop host: Python + FastAPI + pywebview
- Database: SQLite
- Backup: local snapshots plus Google Drive integration
- Packaging: PyInstaller

## Frontend setup

1. Install Node dependencies:
   `npm install`
2. Run the frontend only:
   `npm run frontend:dev`
3. Build frontend assets for desktop packaging:
   `npm run frontend:build`

## Python desktop setup

1. Install Python dependencies:
   `pip install -r backend/requirements.txt`
2. Build the frontend:
   `npm run frontend:build`
3. Run the desktop app in browser-hosted dev mode:
   `npm run desktop:dev`
4. Build the Windows executable:
   `npm run desktop:build`

## Google Drive backup

1. Create a Google OAuth desktop client in Google Cloud Console.
2. Place the downloaded credentials JSON at `%APPDATA%/GuardManagerPro/google_credentials.json` or set the path in Settings.
3. Open `Settings` in the app and connect Google Drive.
