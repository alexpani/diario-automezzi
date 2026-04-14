# Diario automezzi v1.2

Applicazione web per la gestione del garage e il tracciamento degli interventi di manutenzione sui propri veicoli.

## Funzionalità

### Garage
- Aggiunta, modifica e cancellazione di veicoli
- Informazioni per veicolo: marca, modello, anno, targa, note
- Statistiche rapide: numero interventi e ultimi km registrati
- Navigazione diretta agli interventi di un veicolo

### Interventi
- Registrazione di interventi di manutenzione con descrizione, data, km e note
- Associazione di ogni intervento a un veicolo
- Filtro per veicolo, anno (popolato dinamicamente) e ricerca testuale
- Ordinamento per data crescente/decrescente

### Sincronizzazione
- Salvataggio automatico con debounce da 400ms
- Indicatore di stato in tempo reale (Salvataggio / Sincronizzato / Errore rete)
- Auto-refresh ogni 60 secondi

## Tecnologie

- **Frontend:** HTML5, CSS3, JavaScript vanilla (single-page application)
- **Backend:** Node.js + Express.js
- **Storage:** SQLite (`better-sqlite3`), file `data.db` locale

## Installazione locale

```bash
npm install
npm start
```

L'applicazione è disponibile su `http://localhost:3000`.

Variabili d'ambiente supportate:

| Variabile  | Default         | Descrizione                                |
|------------|-----------------|--------------------------------------------|
| `PORT`     | `3000`          | Porta di ascolto HTTP                      |
| `DB_FILE`  | `./data.db`     | Path del file SQLite                       |

## Struttura dati

SQLite con due tabelle:

```sql
CREATE TABLE cars (
  id     TEXT PRIMARY KEY,
  brand  TEXT NOT NULL,
  model  TEXT NOT NULL,
  year   INTEGER,
  plate  TEXT,
  notes  TEXT
);

CREATE TABLE interventions (
  id          TEXT PRIMARY KEY,
  car_id      TEXT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  date        TEXT NOT NULL,
  km          INTEGER,
  notes       TEXT
);
```

Il backend espone all'API il campo `car_id` come `carId` per mantenere il contratto JSON del frontend.

## API

| Metodo | Endpoint        | Descrizione             |
|--------|-----------------|-------------------------|
| GET    | `/api/data`     | Recupera tutti i dati   |
| PUT    | `/api/data`     | Salva tutti i dati      |
| GET    | `/api.php`      | Alias di `/api/data`    |
| PUT    | `/api.php`      | Alias di `/api/data`    |

Il payload è `{ cars: [...], interventions: [...] }`.

## Migrazione da `data.json` a SQLite

Se hai una vecchia installazione file-based:

```bash
# copia il vecchio data.json nella root del progetto, poi:
npm run import              # usa ./data.json e scrive ./data.db
# oppure passa un path esplicito:
node scripts/import-json.js /path/al/vecchio/data.json
```

Lo script svuota e riscrive le tabelle in una singola transazione, scartando eventuali interventi orfani (con `carId` non esistente).

## Deploy su LXC Debian 13 (Proxmox)

Queste istruzioni presumono un container LXC con Debian 13 (Trixie) già attivo e accessibile via SSH come `root`.

### 1. Preparare il sistema

```bash
apt update && apt upgrade -y
apt install -y curl git build-essential python3 ca-certificates

# Node.js 20 LTS da NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### 2. Utente dedicato e directory

```bash
adduser --system --group --home /opt/diario-automezzi --shell /usr/sbin/nologin diario
mkdir -p /var/lib/diario-automezzi
chown diario:diario /var/lib/diario-automezzi
```

### 3. Codice e dipendenze

```bash
cd /opt
git clone https://github.com/alexpani/diario-automezzi.git
cd diario-automezzi
npm ci --omit=dev
chown -R diario:diario /opt/diario-automezzi
```

> `better-sqlite3` viene compilato nativamente: servono `build-essential` e `python3`, già installati al passo 1.

### 4. Migrare i dati da `data.json`

Dal tuo PC, copia il file `data.json` esportato dall'hosting precedente nella LXC:

```bash
scp data.json root@<ip-lxc>:/tmp/data.json
```

Nella LXC, esegui l'import come utente `diario` così i permessi sono corretti:

```bash
sudo -u diario DB_FILE=/var/lib/diario-automezzi/data.db \
  node /opt/diario-automezzi/scripts/import-json.js /tmp/data.json
rm /tmp/data.json
```

Output atteso:

```
Import da: /tmp/data.json
DB target:  /var/lib/diario-automezzi/data.db
  → cars: N
  → interventions: M
✓ Import completato: N veicoli, M interventi
```

### 5. Servizio systemd

```bash
cp /opt/diario-automezzi/deploy/diario-automezzi.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now diario-automezzi
systemctl status diario-automezzi
```

L'app risponde su `http://<ip-lxc>:3000`. Log in tempo reale:

```bash
journalctl -u diario-automezzi -f
```

### 6. Aggiornamenti successivi

```bash
cd /opt/diario-automezzi
git pull
npm ci --omit=dev
systemctl restart diario-automezzi
```

### 7. Backup del database

SQLite supporta backup a caldo; per una copia consistente usa `sqlite3` (o `.backup`):

```bash
apt install -y sqlite3
sqlite3 /var/lib/diario-automezzi/data.db ".backup '/root/backup-$(date +%F).db'"
```

Oppure semplicemente copia i file `data.db`, `data.db-wal`, `data.db-shm` quando il servizio è fermo.

## Changelog

### v1.2
- Migrazione storage da `data.json` a SQLite (`better-sqlite3`)
- Script `scripts/import-json.js` per importare dati esistenti
- Unit file systemd per deploy su LXC Debian 13 (Proxmox)
- Guida di deploy aggiornata

### v1.1
- Filtro anno: reset automatico al cambio veicolo
- Filtro anno: anni popolati dinamicamente in base agli interventi del veicolo selezionato

### v1.0
- Prima versione pubblica
