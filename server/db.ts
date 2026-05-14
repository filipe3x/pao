import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  const dbPath = process.env.DB_PATH ?? "./data/pao.db";
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _db = new DatabaseSync(dbPath);
  _db.exec("PRAGMA journal_mode = WAL;");
  _db.exec("PRAGMA foreign_keys = ON;");
  _db.exec("PRAGMA synchronous = NORMAL;");
  return _db;
}

export function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      subtitle            TEXT,
      weekly_consumption  REAL DEFAULT 2,
      is_custom           INTEGER NOT NULL DEFAULT 0,
      created_at          INTEGER NOT NULL,
      updated_at          INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sections (
      recipe_id   TEXT NOT NULL,
      section_id  TEXT NOT NULL,
      name        TEXT NOT NULL,
      kicker      TEXT,
      tone        TEXT NOT NULL,
      optional    INTEGER NOT NULL DEFAULT 0,
      sort_index  INTEGER NOT NULL,
      PRIMARY KEY (recipe_id, section_id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      recipe_id       TEXT NOT NULL,
      section_id      TEXT NOT NULL,
      ingredient_key  TEXT NOT NULL,
      name            TEXT NOT NULL,
      grams           REAL NOT NULL,
      unit            TEXT,
      package_price   REAL DEFAULT 0,
      package_grams   REAL DEFAULT 1000,
      is_free         INTEGER NOT NULL DEFAULT 0,
      is_exact        INTEGER NOT NULL DEFAULT 0,
      note            TEXT,
      sort_index      INTEGER NOT NULL,
      PRIMARY KEY (recipe_id, ingredient_key),
      FOREIGN KEY (recipe_id, section_id) REFERENCES sections(recipe_id, section_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS ix_ingredients_recipe_section
      ON ingredients (recipe_id, section_id, sort_index);
  `);
}
