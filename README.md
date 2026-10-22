# FairPlan

Praktikopgave med React, TypeScript, Flask og MariaDB.
Opbygningen følger WashWorldValde: sider, ét component, et login-hook og SQL i backend.

## Start

Åbn Docker Desktop. Kør i projektmappen:

```powershell
docker compose up -d --build
```

- App: http://127.0.0.1:3001
- phpMyAdmin: http://127.0.0.1:8081

I phpMyAdmin: log ind med **root** / **password**, vælg **fairplan**, og klik på en tabel.
MariaDB er databasen. phpMyAdmin viser tabeller og data i browseren.
Data gemmes i Docker-volumenet `fairplan_fairplan_data` og bevares ved genstart.
Stop med `docker compose down`. `python run.py` starter også projektet med Docker.

## Login i appen

Demokode: `Fairplan2026!`.

| E-mail | Rolle |
| --- | --- |
| sofie.andersen@example.com | Admin og Personale |
| ida.petersen@example.com | Admin |
| anna.moller@example.com | Personale |

Admin administrerer data. Personale kan se personaleoversigten. En bruger kan have begge roller.
Eksempeldata indsættes kun i en tom database. Eksisterende data og koder bliver bevaret.

## Koden

```text
frontend/app/              Sider, formularer og deres funktioner
frontend/components/       PageLayout.tsx: menu og logo
frontend/hooks/            Tjek login-token og hent brugeren
frontend/lib/api.ts        Kald til Flask
backend/app.py             API og forretningsregler
backend/auth.py            Login og rettigheder
backend/database.py        SQL-kald til MariaDB
backend/validators.py      Kontrol af felter
database/init.sql          Databasens tabeller
```

Læs [kodeforklaringen](EKSAMEN_FLOW.md) og [opgavekravene](docs/OPGAVE.md).

## Test

Start Docker først. Lokale tests kræver Python 3.11+ og Node.js 20.9+:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
.venv/Scripts/python.exe -m unittest discover -s backend/tests
cd frontend
npm ci
npm run typecheck
npm run test:e2e
```

Testene bruger separate MariaDB-databaser. De ændrer ikke dine data.
På Windows bruger browsertestene Edge; ellers installeres Chromium med `npx playwright install chromium`.
