# Sådan hænger koden sammen

Som i WashWorldValde:

```text
page.tsx → api.ts → app.py → database.py → MariaDB
```

## Eksempel: opret en periode

1. Formularen står direkte i `frontend/app/perioder/page.tsx`.
2. `save()` læser felterne med `FormData` og kalder `createPeriod()`.
3. `api.ts` sender en POST til Flask.
4. `validate_period()` kontrollerer navn, datoer og overlap.
5. `execute()` gemmer med SQL i MariaDB.
6. Siden henter den opdaterede liste og lukker formularen.

Redigering bruger samme formular. Sletning bruger browserens `confirm()`.
Søgning, sortering og filtrering sker på sidens data i React.

## Login

`useCurrentUser()` tjekker tokenet i localStorage og henter brugeren.
`api.ts` sender tokenet i Authorization-headeren. Backend kontrollerer rollerne.
Adgangskoder gemmes som hash. En session udløber efter otte timer.
En bruger kan både være Admin og Personale.

## Databasen

MariaDB gemmer data. phpMyAdmin er siden, hvor man kan se tabellerne.
Åbn http://127.0.0.1:8081, log ind med root / password og vælg fairplan.

- `periods`: planperioder
- `sections`: afsnit og farver
- `staff_groups`: personalegrupper
- `users`: brugere, roller og adgangskodehash
- `employments`: ansættelser med fremmednøgler til de tre tabeller ovenfor
- `login_sessions`: login-token som hash og udløbstid
- `app_meta`: husker, at eksempeldata allerede er oprettet

## Regler i backend

Startdato skal være før slutdato. Perioder må ikke overlappe.
Ansættelser må ikke overlappe for samme person, og timer skal være et heltal fra 0 til 37.
Personen skal have rollen Personale. E-mail skal være unik, og en bruger skal have mindst én rolle.
Brugere, afsnit og grupper med ansættelser kan ikke slettes.
Personaleoversigten viser ansættelser, som overlapper den valgte periode.

`run_transaction()` samler kontrol og gemning. Hvis noget fejler, bliver ændringen rullet tilbage.
Backendtestene bruger rigtige MariaDB-tabeller. Browsertestene gennemfører brugerflows.

Udviklet med hjælp fra Codex.
