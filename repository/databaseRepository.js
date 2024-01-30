const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('./db/copytrade.db');

db.getAll = function getAll(tableName) {
  return _allAsync(`SELECT * FROM ${tableName}`);
}

db.getOne = function getOne(tableName, id) {
  return _getAsync(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
}

db.insert = function insert(tableName, fields, values) {
  // return _runAsync(`INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`, values);
  // insert and return id
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`, values, function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
        });
    });
}

db.update = function update(tableName, id, fields, values) {
  return _runAsync(`UPDATE ${tableName} SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`, [...values, id]);
}

db.remove = function remove(tableName, id) {
  return _runAsync(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
}

// inner methods
_allAsync = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

_getAsync = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

_runAsync = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

db._allAsync = _allAsync;
db._getAsync = _getAsync;
db._runAsync = _runAsync;


module.exports = db;
