const express = require('express');
const path    = require('path');
const Database = require('better-sqlite3');

const app      = express();
const PORT     = process.env.PORT || 3000;
const DB_FILE  = process.env.DB_FILE || path.join(__dirname, 'data.db');

// ── DB setup ────────────────────────────────────
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS cars (
    id     TEXT PRIMARY KEY,
    brand  TEXT NOT NULL,
    model  TEXT NOT NULL,
    year   INTEGER,
    plate  TEXT,
    notes  TEXT
  );

  CREATE TABLE IF NOT EXISTS interventions (
    id          TEXT PRIMARY KEY,
    car_id      TEXT NOT NULL,
    description TEXT NOT NULL,
    date        TEXT NOT NULL,
    km          INTEGER,
    notes       TEXT,
    FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_interventions_car_id ON interventions(car_id);
`);

// ── Prepared statements ─────────────────────────
const selectCars          = db.prepare('SELECT id, brand, model, year, plate, notes FROM cars');
const selectInterventions = db.prepare('SELECT id, car_id AS carId, description, date, km, notes FROM interventions');

const insertCar = db.prepare(`
  INSERT INTO cars (id, brand, model, year, plate, notes)
  VALUES (@id, @brand, @model, @year, @plate, @notes)
`);

const insertIntervention = db.prepare(`
  INSERT INTO interventions (id, car_id, description, date, km, notes)
  VALUES (@id, @carId, @description, @date, @km, @notes)
`);

const deleteAllInterventions = db.prepare('DELETE FROM interventions');
const deleteAllCars          = db.prepare('DELETE FROM cars');

// Rimpiazza interamente cars+interventions in una transazione
const replaceAll = db.transaction((cars, interventions) => {
  deleteAllInterventions.run();
  deleteAllCars.run();
  for (const c of cars) {
    insertCar.run({
      id:    String(c.id),
      brand: String(c.brand ?? ''),
      model: String(c.model ?? ''),
      year:  c.year == null ? null : Number(c.year),
      plate: c.plate == null ? null : String(c.plate),
      notes: c.notes == null ? null : String(c.notes),
    });
  }
  for (const i of interventions) {
    insertIntervention.run({
      id:          String(i.id),
      carId:       String(i.carId),
      description: String(i.description ?? ''),
      date:        String(i.date ?? ''),
      km:          i.km == null ? null : Number(i.km),
      notes:       i.notes == null ? null : String(i.notes),
    });
  }
});

// ── Middleware ──────────────────────────────────
app.use(express.json({ limit: '10mb' }));

// ── Handlers ────────────────────────────────────
function handleGet(req, res) {
  res.json({
    cars:          selectCars.all(),
    interventions: selectInterventions.all(),
  });
}

function handlePut(req, res) {
  const { cars, interventions } = req.body || {};
  if (!Array.isArray(cars) || !Array.isArray(interventions)) {
    return res.status(400).json({ error: 'Payload non valido' });
  }
  try {
    replaceAll(cars, interventions);
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/data:', err);
    res.status(500).json({ error: 'Errore salvataggio' });
  }
}

// Stesse rotte su /api/data e /api.php (compatibilità frontend)
app.get(['/api/data', '/api.php'], handleGet);
app.put(['/api/data', '/api.php'], handlePut);

// ── File statici — DOPO le rotte API ────────────
app.use(express.static(__dirname));

// ── Shutdown pulito ─────────────────────────────
function shutdown() {
  try { db.close(); } catch {}
  process.exit(0);
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

// ── Avvio ───────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nCar Tracker → http://localhost:${PORT}  (db: ${DB_FILE})\n`);
});
