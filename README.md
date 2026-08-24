# Electrotech

Electrotech is organized as a single repository with independently installable frontend and backend applications.

```text
frontend/  React/Vinext website and current same-origin quote route
backend/   Express/TypeScript API for independent Belmo deployment
```

The frontend also includes `/solar-bill-analyzer`, which sends temporary bill uploads and verified consumption data to the standalone backend. Gemini is limited to structured bill-data extraction; PV, inverter, battery, generation, and architecture recommendations are deterministic application calculations.

## Frontend

```bash
cd frontend
npm ci
npm run dev
```

See `frontend/README.md` for frontend environment and validation details.

## Backend

```bash
cd backend
npm ci
npm run typecheck
npm run build
npm test
npm start
```

See `backend/README.md` for backend environment, proxy and deployment details.
