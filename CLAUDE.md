# CLAUDE.md

Guida per sessioni Claude Code che lavorano su questo repository. Tieni queste note aggiornate ogni volta che cambia l'architettura, il deploy o le convenzioni.

## Cos'è Car Tracker

Single-page web app per tenere traccia del garage personale (veicoli) e degli interventi di manutenzione. Pensata per un singolo utente, deployata in casa su un LXC Proxmox.

## Stack

- **Frontend**: `index.html` — HTML/CSS/JS vanilla, nessun bundler, nessun framework. Una sola pagina con due tab (Garage, Interventi) e logica di sync verso il backend.
- **Backend**: `server.js` — Express 4, single-file, espone GET/PUT su `/api/data` (e alias legacy `/api.php`). Usa `better-sqlite3` in modalità sincrona.
- **DB**: SQLite locale (`data.db`), WAL mode, due tabelle `cars` e `interventions` con FK `ON DELETE CASCADE`.
- **Legacy**: `api.php` esiste ancora come fallback PHP per hosting condiviso, e `.github/workflows/deploy.yml` fa FTP deploy sulla stessa struttura. Non più usato in produzione ma lasciato per compatibilità.

## Contratto API (da non rompere)

Il frontend si aspetta:

```
GET  /api/data  → { cars: [...], interventions: [...] }
PUT  /api/data  ← { cars: [...], interventions: [...] }
```

- Il PUT è **full replacement**: il client manda sempre l'intero stato, il server svuota e riscrive tutto in una transazione (`replaceAll` in `server.js`).
- Campi `car` lato JSON: `id, brand, model, year, plate, notes`.
- Campi `intervention` lato JSON: `id, carId, description, date, km, notes`.
- Nel DB il campo `carId` è memorizzato come `car_id`. Il mapping snake_case ↔ camelCase è fatto esclusivamente nelle prepared statement di `server.js` (`SELECT ... car_id AS carId`, `INSERT ... car_id=@carId`).

**Se modifichi il contratto** (nuovi campi, nuove rotte), ricordati di aggiornare in parallelo: `server.js`, `scripts/import-json.js`, `index.html`, e lo schema in `README.md`.

## Comandi utili

```bash
npm install          # installa dipendenze
npm start            # avvia server su PORT (default 3000), usa DB_FILE (default ./data.db)
npm run import       # importa ./data.json nel DB SQLite (path override: node scripts/import-json.js /path/file.json)
```

Variabili d'ambiente: `PORT`, `DB_FILE`.

**Non esistono** lint, test, type-check o build step. Tutto è vanilla JS e HTML. Se vuoi verificare che il server parta basta `node server.js` e un `curl localhost:3000/api/data`.

## File chiave

| File | Cosa fa |
|------|--------|
| `server.js` | Backend Express + SQLite, single file. Schema DB creato qui al boot. |
| `scripts/import-json.js` | One-shot: legge un `data.json` legacy e popola il DB SQLite. Transazionale, scarta interventi orfani. |
| `index.html` | Frontend completo (HTML + CSS + JS inline). Nessun build. La logica di sync è in fondo al file. |
| `api.php` | Fallback legacy per hosting PHP — specchio del contratto API su `data.json`. Non usato in produzione LXC. |
| `deploy/car-tracker.service` | Unit systemd per il deploy su LXC (utente `cartracker`, `/opt/car-tracker`, `/var/lib/car-tracker`). |
| `.github/workflows/deploy.yml` | FTP deploy legacy verso hosting condiviso. Non usato in produzione. |
| `README.md` | Guida utente (installazione, API, migrazione, deploy LXC). Lingua: italiano. |

## Architettura di produzione

App installata su LXC Debian 13 (Proxmox):

- Codice: `/opt/car-tracker` (owner `cartracker:cartracker`)
- DB: `/var/lib/car-tracker/data.db` (owner `cartracker:cartracker`)
- Servizio: `car-tracker.service` (systemd, ascolta su `:3000`)
- Backup: cron.daily con `sqlite3 .backup` in `/var/backups/car-tracker`, retention 14 giorni

Il frontend è servito da Express (`express.static(__dirname)` in fondo a `server.js`), non c'è un reverse proxy. Se in futuro si aggiunge Nginx/HTTPS, configurarlo come reverse proxy verso `localhost:3000`.

## Convenzioni di sviluppo

- **Lingua**: codice e commit in inglese, commenti inline e README in italiano.
- **Mantenere il contratto API**: non introdurre breaking change senza aggiornare anche il frontend. Il PUT resta full-replace; se serve granularità, aggiungi nuove rotte invece di rompere `/api/data`.
- **Semplicità > astrazioni**: niente ORM, niente framework frontend, niente build step. `better-sqlite3` con prepared statement basta.
- **Nessun dato committato**: `data.db`, `data.db-*` (WAL/SHM) e `data.json` sono in `.gitignore`. Mai committare dati reali.
- **Secret/credenziali**: niente `.env` nel repo. FTP secrets sono in GitHub Actions.
- **Versioning**: `package.json` segue SemVer laschetto. Bump minor quando cambiano storage/deploy (es. 1.2 SQLite, 1.3 rename). Tieni il Changelog in `README.md` in sync.

## Rischi da evitare

- Modificare lo schema SQLite senza fornire una migrazione: `server.js` crea le tabelle con `CREATE TABLE IF NOT EXISTS` al boot, quindi aggiunte di colonne a DB esistenti **non** avvengono automaticamente. Se aggiungi colonne, scrivi uno script di migrazione in `scripts/`.
- Rompere il mapping `car_id`/`carId`: le prepared statement in `server.js` e `scripts/import-json.js` sono le uniche che fanno la conversione. Se aggiungi rotte o script, ripeti il mapping.
- Toccare `api.php` pensando che sia attivo: non lo è. Lasciare come riferimento ma non considerarlo codice di produzione.
- Eseguire `git push --force` o `git reset --hard` su `main`: è il branch deployato. Qualsiasi modifica passa da una PR.

## Deploy/rilascio

1. Lavora su un branch feature.
2. PR verso `main`.
3. Merge su `main`.
4. Sul LXC: `cd /opt/car-tracker && git pull && npm ci --omit=dev && systemctl restart car-tracker`.

Non c'è CI/CD automatico verso l'LXC: il pull va fatto a mano (o via un cron / webhook se verrà aggiunto in futuro).
