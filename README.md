# Private Reselling OS

Private Reselling OS är en privat, mobilförst app för att driva en liten klädreselling-verksamhet utan kalkylark. Den hanterar inköp, lager, försäljningar, bilduppladdning, buffert, återinvestering, transaktionshistorik och ekonomiöversikt på svenska.

## Teknik

- Next.js App Router med TypeScript
- Tailwind CSS
- Supabase PostgreSQL och Supabase Storage
- Single-user login med hashat lösenord och HTTP-only cookie
- Vitest för finansiella enhetstester
- PWA-manifest för Lägg till på hemskärmen på iPhone

## Lokal utveckling

1. Kör `npm install`.
2. Kopiera `.env.example` till `.env.local`.
3. Skapa ett Supabase-projekt.
4. Kör migrationsfilerna i `supabase/migrations` i datumordning, eller använd Supabase CLI.
5. Migrationen skapar en publik Storage bucket med namnet `item-images`.
6. Fyll i `NEXT_PUBLIC_SUPABASE_URL` och `SUPABASE_SERVICE_ROLE_KEY`.
7. Kör `npm run hash-password` och klistra in resultatet som `SINGLE_USER_PASSWORD_HASH`.
8. Sätt `SINGLE_USER_EMAIL` till din inloggningsadress.
9. Skapa en lång `SESSION_SECRET`, minst 32 tecken.
10. Kör `npm run dev` och öppna `http://localhost:3000`.

## Miljövariabler

- `NEXT_PUBLIC_APP_URL`: Appens URL, lokalt oftast `http://localhost:3000`.
- `NEXT_PUBLIC_SITE_NAME`: Namn som visas i metadata.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase-projektets URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Hemlig servernyckel från Supabase. Lägg aldrig i webbläsaren.
- `SUPABASE_STORAGE_BUCKET`: Standard är `item-images`.
- `SINGLE_USER_EMAIL`: Den enda e-postadress som får logga in.
- `SINGLE_USER_PASSWORD_HASH`: Hash från `npm run hash-password`.
- `SESSION_SECRET`: Lång hemlighet för sessionscookien.

## Databas och storage

Databasen består av:

- `app_settings`: startkapital, vinstfördelning och onboarding-status.
- `inventory_items`: plagg, inköp, annonsinformation och status.
- `sale_records`: försäljning, avgifter, vinst, marginal, ROI och fördelning.
- `ledger_transactions`: append-only transaktioner för återinvestering och buffert.

Storage används endast för bilder. Bildens URL sparas i databasen, aldrig base64. Bucketen `item-images` skapas av migrationen.

## Ekonomimodell

Pengar sparas i heltals-öre. Inköp minskar återinvestering. Vid försäljning går insatt kapital tillbaka till återinvestering. Positiv vinst delas enligt inställningarna, normalt 80% återinvestering och 20% buffert. Förlust tas från återinvestering och skapar aldrig negativ buffert. Rester från avrundning går till återinvestering så att böckerna alltid stämmer exakt.

## Kommandon

```bash
npm run hash-password
npm test
npm run typecheck
npm run lint
npm run build
```

## Deploy till Vercel

1. Lägg projektet på GitHub.
2. Importera eller länka projektet i Vercel med namnet `private-reselling-os`.
3. Lägg in miljövariablerna från `.env.example` i Vercel. Lägg inte in `NODE_ENV`; Vercel sätter den själv.
4. Sätt `NEXT_PUBLIC_SUPABASE_URL` till `https://kauglulcswmdkgipyraw.supabase.co`.
5. Sätt `NEXT_PUBLIC_APP_URL` till din Vercel-URL.
6. Deploya.
7. Öppna `/login` och logga in med `SINGLE_USER_EMAIL` och lösenordet du hashade.

## Installera som iPhone-app

Öppna appen i Safari, tryck Dela och välj Lägg till på hemskärmen.

## Backup och export

Logga in och gå till Inställningar. Knappen Exportera data laddar ner en JSON-fil med inställningar, lager, försäljningar och transaktioner.
