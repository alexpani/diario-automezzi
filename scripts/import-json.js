#!/usr/bin/env node
/**
 * Importa un file data.json (formato legacy file-based) dentro il DB SQLite.
 *
 * Uso:
 *   node scripts/import-json.js [path/to/data.json]
 *
 * Se non passi un path usa ./data.json nella root del progetto.
 * Variabile d'ambiente opzionale: DB_FILE (default ./data.db).
 *
 * ATTENZIONE: l'import svuota e riscrive tutte le tabelle.
 */

const fs   = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const jsonPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data.json'));
const dbPath   = path.resolve(process.env.DB_FILE || path.join(__dirname, '..', 'data.db'));

if (!fs.existsSync(jsonPath)) {
  console.error(`File non trovato: ${jsonPath}`);
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
} catch (err) {
  console.error(`JSON non valido in ${jsonPath}:`, err.message);
  process.exit(1);
}

const cars          = Array.isArray(payload.cars)          ? payload.cars          : [];
const interventions = Array.isArray(payload.interventions) ? payload.interventions : [];

console.log(`Import da: ${jsonPath}`);
console.log(`DB target:  ${dbPath}`);
console.log(`  → cars:          ${cars.length}`);
console.log(`  → interventions: ${interventions.length}`);

const db = new Database(dbPath);
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

const insertCar = db.prepare(`
  INSERT INTO cars (id, brand, model, year, plate, notes)
  VALUES (@id, @brand, @model, @year, @plate, @notes)
`);

const insertIntervention = db.prepare(`
  INSERT INTO interventions (id, car_id, description, date, km, notes)
  VALUES (@id, @carId, @description, @date, @km, @notes)
`);

const validCarIds = new Set(cars.map(c => String(c.id)));
const orphans = interventions.filter(i => !validCarIds.has(String(i.carId)));
if (orphans.length) {
  console.warn(`⚠  ${orphans.length} intervento/i senza veicolo corrispondente: verranno ignorati`);
}

const importAll = db.transaction(() => {
  db.prepare('DELETE FROM interventions').run();
  db.prepare('DELETE FROM cars').run();

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
    if (!validCarIds.has(String(i.carId))) continue;
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

try {
  importAll();
  const nCars = db.prepare('SELECT COUNT(*) AS n FROM cars').get().n;
  const nInt  = db.prepare('SELECT COUNT(*) AS n FROM interventions').get().n;
  console.log(`✓ Import completato: ${nCars} veicoli, ${nInt} interventi`);
} catch (err) {
  console.error('Errore durante l\'import:', err);
  process.exit(1);
} finally {
  db.close();
}
