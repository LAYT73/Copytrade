const db = require('../repository/databaseRepository');
const {getTokenPrices} = require("./bitqueryService");
const BigNumber = require("bignumber.js");

const TABLE_NAME = 'prices';

async function getAll() {
    return db.getAll(TABLE_NAME);
}

async function getOne(id) {
    return db.getOne(TABLE_NAME, id);
}

async function getByTokenAndDateAndEth(tokenAddress, baseSymbol, quotaSymbol, oneTokenPerEthPrice, date) {
    let ethPrice = await getByTokenAndDate('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', 'ETH', quotaSymbol, date);
    if (!ethPrice) {
        return null;
    }

    //  ethPrice * oneTokenPerEthPrice
    const priceByEth = new BigNumber(ethPrice.price).multipliedBy(oneTokenPerEthPrice).toString();
    let tokenPriceObject = await getByTokenAndDate(tokenAddress, baseSymbol, quotaSymbol, date);
    if (!tokenPriceObject) {
        if (!priceByEth) {
            return null;
        }

        // todo 3 remove hardcode
        return {
            id: -1,
            token_address: tokenAddress,
            base_symbol: baseSymbol,
            quota_symbol: quotaSymbol,
            date: date,
            price: priceByEth
        }
    }

    tokenPriceObject.price = priceByEth;
    return tokenPriceObject;
}

async function getByTokenAndDate(tokenAddress, baseSymbol, quotaSymbol, date) {
    // todo 3 remove hardcode
    if (tokenAddress === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' && baseSymbol === 'ETH') {
        baseSymbol = 'WETH';
    }
    // end hardcode

    let _date = toBaseDate(date);
    let tokenData = await db._allAsync(`SELECT * FROM ${TABLE_NAME} WHERE token_address = '${tokenAddress}' AND base_symbol = '${baseSymbol}' AND quota_symbol = '${quotaSymbol}' AND date = '${_date}'`)
    return tokenData && tokenData.length > 0 ? tokenData[0] : null
}

async function getByTokenFirstByDate(tokenAddress, baseSymbol, quotaSymbol) {
    // todo 3 remove hardcode
    if (tokenAddress === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' && baseSymbol === 'ETH') {
        baseSymbol = 'WETH';
    }
    // end hardcode

    let tokenData = await db._allAsync(`SELECT * FROM ${TABLE_NAME} WHERE token_address = '${tokenAddress}' AND base_symbol = '${baseSymbol}' AND quota_symbol = '${quotaSymbol}' ORDER BY date ASC LIMIT 1`)
    return tokenData && tokenData.length > 0 ? tokenData[0] : null
}

async function getByTokenLastPrice(tokenAddress, baseSymbol, quotaSymbol) {
    // todo 3 remove hardcode
    if (tokenAddress === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' && baseSymbol === 'ETH') {
        baseSymbol = 'WETH';
    }
    // end hardcode

    let tokenData = await db._allAsync(`SELECT * FROM ${TABLE_NAME} WHERE token_address = '${tokenAddress}' AND base_symbol = '${baseSymbol}' AND quota_symbol = '${quotaSymbol}' ORDER BY date DESC LIMIT 1`)
    return tokenData && tokenData.length > 0 ? tokenData[0] : null

}

async function add(fields, values) {
    let dateId = fields.indexOf('date');
    if (dateId >= 0) {
        values[dateId] = toBaseDate(values[dateId]);
    }

    console.log("Add values: ", fields, values)
    return db.insert(TABLE_NAME, fields, values);
}

async function update(id, fields, values) {
    let dateId = fields.indexOf('date');
    if (dateId >= 0) {
        values[dateId] = toBaseDate(values[dateId]);
    }

    return db.update(TABLE_NAME, id, fields, values);
}

async function remove(id) {
    return db.remove(TABLE_NAME, id);
}

function toBaseDate(date) {
    return date.setHours(0, 0, 0, 0);
}

module.exports = {
    getAll,
    getOne,
    getByTokenAndDate,
    getByTokenAndDateAndEth,
    getByTokenFirstByDate,
    getByTokenLastPrice,
    add,
    update,
    remove
};
