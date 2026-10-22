import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { emptyState } from "./core";
import type { State } from "./types";

// Single agency, persistent-disk pilot. SQLite transactions serialize competing reviewers.
// Do not deploy this store on an ephemeral/serverless filesystem.
function open() {
  const path = resolve(
    /* turbopackIgnore: true */ process.env.OPS_DB_PATH ||
      ".data/operations.sqlite",
  );
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec(
    "PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL)",
  );
  db.prepare("INSERT OR IGNORE INTO workspace VALUES (1, ?)").run(
    JSON.stringify(emptyState()),
  );
  return db;
}
export function readState(): State {
  const db = open();
  try {
    return JSON.parse(
      (
        db.prepare("SELECT data FROM workspace WHERE id = 1").get() as {
          data: string;
        }
      ).data,
    );
  } finally {
    db.close();
  }
}
export function mutate<T>(fn: (state: State) => T): T {
  const db = open();
  try {
    db.exec("BEGIN IMMEDIATE");
    const state: State = JSON.parse(
      (
        db.prepare("SELECT data FROM workspace WHERE id = 1").get() as {
          data: string;
        }
      ).data,
    );
    const result = fn(state);
    db.prepare("UPDATE workspace SET data = ? WHERE id = 1").run(
      JSON.stringify(state),
    );
    db.exec("COMMIT");
    return result;
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}
