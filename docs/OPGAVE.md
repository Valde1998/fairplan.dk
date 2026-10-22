# FairPlan – opgaven

Krav fra opgavemailen af 19. oktober 2026.

## Sider og funktioner

Venstremenuen skal indeholde Perioder, Organisering, Adgangsstyring og Personale.

- **Perioder:** Opret, rediger og slet. Navn, startdato og slutdato er påkrævede. Start skal være før slut. Perioder må ikke overlappe, men må følge umiddelbart efter hinanden. Søgning, sortering og filtrering.
- **Organisering → Afsnit:** Opret, rediger og slet. Navn og gyldig HEX-farve. Afsnit med ansættelser må ikke slettes; vis forklarende fejl. Søgning, sortering og filtrering.
- **Organisering → Personalegrupper:** Opret, rediger og slet. Navn. Grupper med ansættelser må ikke slettes; vis forklarende fejl. Søgning, sortering og filtrering.
- **Adgangsstyring → Adgange:** Opret, rediger og slet. Navn, unik e-mail, Admin (ja/nej), Personale (ja/nej). Alle felter er påkrævede. En bruger skal have én eller begge roller. Brugere med ansættelser må ikke slettes. Sortering og filtrering.
- **Adgangsstyring → Ansættelser:** Opret, rediger og slet. Person, afsnit og personalegruppe vælges fra databasen i dropdowns. Person skal have rollen Personale. Timer pr. uge er et heltal fra 0 til 37. Startdato og slutdato; slut skal være efter start. Samme person kan have flere ansættelser, men de må ikke overlappe. Søgning, sortering og filtrering samt tydelige fejl.
- **Personale:** Skrivebeskyttet tabel med navn, afsnit, personalegruppe og timer pr. uge. Vælg periode; listen opdateres automatisk. Medtag ansættelser, som overlapper den valgte periode. Søgning, sortering og filtrering.

## Tekniske krav

React og TypeScript. Rigtig backend (C#/.NET er nævnt som eksempel, tilsvarende teknologi er tilladt). Database med permanent lagring. Ingen mockdata som erstatning for reel funktionalitet; indledende testdata i databasen er tilladt. Forretningsregler håndhæves i backend. Overskuelig kode og relevante tests af centrale regler.

Skabelonen er ikke et krav. Løsningen bruger React/TypeScript, Flask og MariaDB i et permanent Docker-volumen.

## Aflevering

Senest fredag 23. oktober 2026 kl. 13.30: repository-link og skærmoptagelse på højst 5 minutter. Videoen skal dække opgaven, brugerflows/værdi samt arkitektur, forretningsregler, kvalitet og tekniske afvejninger. Demo-møde kl. 14.00–14.30.

## Bevidste valg

- Datoer er kalenderdatoer uden klokkeslæt. Begge ender er inklusive: 1.–31. december efterfulgt af 1.–31. januar er tilladt; samme slut/startdag tæller som overlap.
- Start og slut er begge påkrævede; en periode på én dag afvises, fordi start skal være før slut.
- E-mail trimmes og gemmes med små bogstaver. HEX accepterer #RGB og #RRGGBB og normaliseres til seks cifre.
- En person kan have flere ikke-overlappende ansættelser inden for en valgt planperiode. Personalesiden viser én række pr. relevant ansættelse, så afsnit og timer ikke bliver misvisende.
- Personale-rollen kan ikke fjernes, mens personen har ansættelser.
- Adgangsstyring betyder bruger- og rolleadministration i opgaven. Login er ikke et beskrevet krav, men er efterfølgende tilføjet på Valdemars udtrykkelige ønske: e-mail/adgangskode, logout og rettigheder i backend. Admin administrerer alle data; Personale ser personaleoversigten. Begge roller kan markeres samtidig. Mailbekræftelse, løn og automatisk vagtfordeling er fortsat uden for opgaven.
- Appen er en lokal praktikdemo med fiktive startdata. Login beskytter den lokale app. En offentlig flerbrugerudgave kræver yderligere HTTPS, sikring mod gentagne loginforsøg, drift og backup.
