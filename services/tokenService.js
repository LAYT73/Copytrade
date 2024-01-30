const db = require('../repository/databaseRepository');

const TABLE_NAME = 'tokens';

async function getAll() {
    return db.getAll(TABLE_NAME);
}

async function getByAddressAndChain(address, chain) {
    let tokenData = await db._allAsync(`SELECT * FROM ${TABLE_NAME} WHERE address = '${address}' AND chain = '${chain}'`)
    return tokenData && tokenData.length > 0 ? tokenData[0] : null
}

async function getOne(id) {
    return db.getOne(TABLE_NAME, id);
}

async function add(fields, values) {
    let id = await db.insert(TABLE_NAME, fields, values);
    return await getOne(id);
}

async function update(id, fields, values) {
    await db.update(TABLE_NAME, id, fields, values);
    return await getOne(id);
}

async function remove(id) {
    return db.remove(TABLE_NAME, id);
}

module.exports = {
    getAll,
    getByAddressAndChain,
    getOne,
    add,
    update,
    remove
};
