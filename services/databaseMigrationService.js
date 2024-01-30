// database migration service. we have a migration folder with migration files like init.sql, 1.sql, 2.sql, 3.sql, etc.
// when the app starts, it checks the database version and runs the migrations that are not yet applied. check version by running PRAGMA user_version; in sqlite3
//
const db = require('../repository/databaseRepository');

const fs = require('fs');
const path = require('path');

const migrationsPath = path.join(__dirname, '../db/migrations');

function getCurrentVersion() {
  return db._getAsync('PRAGMA user_version;');
}

function applyMigration(version) {
  return db._runAsync(`PRAGMA user_version = ${version};`);
}

function getMigrationVersion(filename) {
  return parseInt(filename.split('__')[0]);
}

function getMigrations() {
  return fs.readdirSync(migrationsPath).filter((filename) => filename.endsWith('.sql')).sort((a, b) => getMigrationVersion(a) - getMigrationVersion(b));
}

async function migrate() {
  const currentVersion = await getCurrentVersion();
  const migrations = getMigrations();

  let ifAnyMigrationApplying = false;
  for (let migration of migrations) {
    const migrationVersion = getMigrationVersion(migration);
    if (migrationVersion > currentVersion.user_version) {
      const migrationContent = fs.readFileSync(path.join(migrationsPath, migration)).toString();
      await db._runAsync(migrationContent);
      await applyMigration(migrationVersion);
      console.log(`Applied migration v${migrationVersion}, ${migration}`);
      ifAnyMigrationApplying = true;
    }
  }

  if (!ifAnyMigrationApplying) {
    console.log('All migrations are success applied! Current migration version: ', currentVersion.user_version);
  }
}

module.exports = {
  migrate
};


