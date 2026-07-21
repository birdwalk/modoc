# Deployment

Local development:

```powershell
.\.venv\Scripts\python -m uvicorn modeldoctor_api.main:app --reload --reload-dir apps\api --app-dir apps\api --host 127.0.0.1 --port 8010
npm.cmd --workspace apps/web run dev -- --port 3001
```

Production direction:

- Run API behind HTTPS.
- Store artifacts in object storage.
- Store metadata in PostgreSQL.
- Move geometry analysis to queue-backed workers.
- Serve frontend through Next.js production build.
- Configure strict CORS and authenticated access.
