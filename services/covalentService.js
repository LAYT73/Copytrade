const moment = require('moment');
const { CovalentClient } = require("@covalenthq/client-sdk");

const COVALENT_CLIENT = new CovalentClient("ckey_be6ae76a05f940e1aae6adc7540");


// start_date and end_date are YYYY-MM-DD string format, dates may be null - in this case we will get today prices
// if only start_date is null, we will get prices from start_date to today
async function getPrices(tokenAddress, price_currency = 'USD', start_date, end_date) {
    let token = await getTokenWithPrices(tokenAddress, price_currency, start_date, end_date);
    return token && token.prices && token.prices.length ? token.prices : [];
}

async function getTokenWithPrices(tokenAddress, price_currency = 'USD', start_date, end_date) {
    console.log("Get Token With Prices data: ", tokenAddress, price_currency, start_date, end_date)
    let query = null
    if (start_date && end_date) {
        query = {
            from: moment(start_date).format('YYYY-MM-DD'),
            to: moment(end_date).format('YYYY-MM-DD')
        }
    }

    if (start_date && !end_date) {
        query = {
            from: moment(start_date).format('YYYY-MM-DD'),
        }
    }

    let tokenResponse = await COVALENT_CLIENT.PricingService.getTokenPrices("eth-mainnet", price_currency, tokenAddress, query);
    // console.log("tokenResponse: ", tokenResponse)
    let tokenData = tokenResponse.data;
    if (tokenData.length && tokenData[0]) {
        let token = tokenData.find(p => p.contract_address === tokenAddress);
        return token ? token : null;
    } else {
        return null;
    }
}

// add export
module.exports = {
    getPrices,
    getTokenWithPrices
};
