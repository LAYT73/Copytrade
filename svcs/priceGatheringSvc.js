const fs = require('fs');
const readline = require('readline');
const csv = require('fast-csv');
const stablecoins = process.env.STABLECOINS.split(',');
const wrappedEther = process.env.WRAPPEDETHER;
const {axiosBinance, axiosMoralis, axiosDexguru, axiosBitquery} = require('../utils/axiosConfig');
const {log} = require('console');

const tokenService = require('../services/tokenService');
const priceService = require('../services/priceService');
const covalentService = require('../services/covalentService');
const bitqueryService = require('../services/bitqueryService');
const moment = require("moment");

const PRICE_UPDATE_HOURS = 24; // 24 hours
const PRICE_TO_UPDATE_LAST_DAYS = 180; // 180 days - 6 months
const PRICE_CURRENCY_SYMBOL = 'USD';
const TOKEN_CHAIN = 'eth-mainnet';


async function updateKlineCSV(startTime, endTime) {
    startTime = startTime.toString().length === 10 ? startTime * 1000 : startTime;
    endTime = endTime.toString().length === 10 ? endTime * 1000 : endTime;
    const filePath = './svcs/blob.csv';

    // Read first and last line to get the timestamps
    let firstTimestamp = null;
    let lastTimestamp = null;

    if (fs.existsSync(filePath)) {
        [firstTimestamp, lastTimestamp] = await readFirstAndLastTimestamps(filePath);
    }

    let toPushBefore = [];
    let toPushAfter = [];

    // Fetch data before the first timestamp if needed
    if (firstTimestamp === null || startTime < firstTimestamp) {
        toPushBefore = await fetchKlinesInBatches('ETHUSDT', '1h', startTime, firstTimestamp ? firstTimestamp - 1 : endTime);
    }

    // Fetch data after the last timestamp if needed
    if (lastTimestamp === null || endTime > lastTimestamp) {
        toPushAfter = await fetchKlinesInBatches('ETHUSDT', '1h', lastTimestamp ? lastTimestamp + 1 : startTime, endTime);
    }

    // Write to the file
    if (toPushBefore.length > 0) {
        const beforeString = toPushBefore.map(kline => kline.join(',')).join('\n') + '\n';
        fs.writeFileSync('temp.csv', beforeString);
        fs.appendFileSync('temp.csv', fs.readFileSync(filePath));
        fs.renameSync('temp.csv', filePath);
    }

    if (toPushAfter.length > 0) {
        const afterString = toPushAfter.map(kline => kline.join(',')).join('\n');
        fs.appendFileSync(filePath, `\n${afterString}`);
    }

    console.log('CSV file has been updated.');

    async function readFirstAndLastTimestamps(filePath) {
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let firstLine;
        let lastLine;
        for await (const line of rl) {
            if (!firstLine) {
                firstLine = line;
            }
            lastLine = line;
        }

        const firstTimestamp = firstLine ? parseInt(firstLine.split(',')[0], 10) : null;
        const lastTimestamp = lastLine ? parseInt(lastLine.split(',')[0], 10) : null;

        return [firstTimestamp, lastTimestamp];
    }

    async function fetchKlinesInBatches(symbol, interval, startTime, endTime) {
        const limit = 500; // Set by Binance's API limit
        let allKlines = [];

        while (startTime < endTime) {
            let fetchEndTime = startTime + limit * 3600000; // Add 500 hours in milliseconds
            if (fetchEndTime > endTime) {
                fetchEndTime = endTime;
            }

            const batch = await fetchKlinesFromBinance(symbol, interval, startTime, fetchEndTime);
            allKlines.push(...batch);

            if (batch.length < limit) {
                break; // Less than limit means we've reached the end
            }

            // Update startTime to the last fetched kline's open time plus one interval
            startTime = parseInt(batch[batch.length - 1][0], 10) + 3600000; // Add 1 hour in milliseconds
        }

        return allKlines;
    }

    async function fetchKlinesFromBinance(symbol, interval, startTime, endTime) {
        const url = 'https://api.binance.com/api/v3/klines';
        const params = {
            symbol: symbol,
            interval: interval,
            startTime: startTime,
            endTime: endTime,
            limit: 500
        };

        const response = await axiosBinance.get(url, {params});
        return response.data;
    }
}

function findAveragePriceByTimestamp(timestamp, klines) {
    timestamp = timestamp.toString().length === 10 ? timestamp * 1000 : timestamp;
    for (let klineStr of klines) {
        let kline = klineStr.split(',');

        let openTime = parseInt(kline[0], 10); // Index 0 for open time
        let openPrice = parseFloat(kline[1]); // Index 1 for open price
        let closePrice = parseFloat(kline[4]); // Index 4 for close price
        let closeTime = parseInt(kline[6], 10); // Index 6 for close time

        if (timestamp >= openTime && timestamp <= closeTime) {
            let averagePrice = (openPrice + closePrice) / 2;
            return averagePrice;
        }
    }

    return null;
}

async function updateTokensPrices() {
    console.log(" === Start historic prices update ===");
    let tokens = await tokenService.getAll();
    let updatedTokens = [];
    for (let token of tokens) {
        let isUpdated = await updatePriceIsNeeded(token);
        if (isUpdated) {
            updatedTokens.push(token);
        }
    }

    console.log("Updated tokens: ", updatedTokens.length);
    console.log(" === End historic prices update ===");
}

async function updatePriceIsNeeded(token) {
    const now = new Date();
    let needForUpdateDate = moment(now).subtract(PRICE_UPDATE_HOURS, 'hours').toDate();
    console.log("Threshold for price update date: ", moment(needForUpdateDate).format('YYYY-MM-DD mm:ss'));

    let tokenLastUpdateDate = token.last_price_update_date ? new Date(token.last_price_update_date) : null;
    console.log(`Token ${token.address} last update date: ${moment(tokenLastUpdateDate).format('YYYY-MM-DD mm:ss')}`);
    if (tokenLastUpdateDate && tokenLastUpdateDate >= needForUpdateDate) {
        return false;
    }

    console.log(`Token ${token.address} need to price update`);
    let maxForUpdateDate = moment(now).subtract(PRICE_TO_UPDATE_LAST_DAYS, 'days').toDate();
    let startDate;
    if (tokenLastUpdateDate < maxForUpdateDate || !tokenLastUpdateDate) {
        startDate = maxForUpdateDate;
    } else {
        startDate = tokenLastUpdateDate;
    }
    let endDate = now;
    console.log(`Token ${token.address} need to price update from ${moment(startDate).format('YYYY-MM-DD')} to ${moment(endDate).format('YYYY-MM-DD')}`);
    await updateHistoricalTokenPrices(token, startDate, endDate);
    return true;
}

async function updateHistoricalTokenPrices(token, startDate, endDate) {
    await covalentService.getPrices(token.address, PRICE_CURRENCY_SYMBOL, startDate, endDate).then(async prices => {
        if (isExistPricesData(prices)) {
            await updateTokenPrices(token, prices);
        } else {
            let price = await bitqueryService.getTokenPrices(token.address, moment(new Date()).subtract(PRICE_TO_UPDATE_LAST_DAYS, 'days'), new Date());
            await updateTokenFixedPrices(token, price);
        }
    }).catch(error => {
        console.error("Error: ", error);
    });
}

function isExistPricesData(prices) {
    return prices && prices.length && prices[0].price !== null && prices[0].price !== undefined && prices[0].price !== 0;
}

// todo 3 remove hardcode
async function updateTokenFixedPrices(token, price) {
    let prices = [];
    // price its same price with different dates, count of dates = PRICE_TO_UPDATE_LAST_DAYS every daye
    for (let i = 0; i < PRICE_TO_UPDATE_LAST_DAYS; i++) {
        prices.push({
            date: moment(new Date()).subtract(i, 'days').toDate(),
            price: price
        });
    }

    await updateTokenPrices(token, prices);
}

async function updateTokenPrices(token, prices) {
    for (let i = 0; i < prices.length; i++) {
        let price = prices[i];
        const date = price.date;
        let dbPrice = await priceService.getByTokenAndDate(token.address, token.symbol, PRICE_CURRENCY_SYMBOL, date);
        if (dbPrice) {
            console.log(`Price already exists. Token ${token.symbol}, Price Usd: ${price.price} Date: ${moment(date).format('YYYY-MM-DD')}`);
            await tokenService.update(token.id, ['last_price_update_date'], [new Date()]);
            continue;
        }

        await priceService.add(['token_address', 'base_symbol', 'quota_symbol', 'date', 'price'], [token.address, token.symbol, PRICE_CURRENCY_SYMBOL, date, price.price]);
        await tokenService.update(token.id, ['last_price_update_date'], [new Date()]);
        console.log(`Price Updated! Token ${token.symbol}, Price Usd: ${price.price} Date: ${moment(date).format('YYYY-MM-DD')}`)
    }
}

async function getTokenPrice(tokenAddress, symbol, date) {
    try {
        let tokenInit = await initIsNotExistingToken(tokenAddress);
        if (!tokenInit) {
            console.error(`Token ${tokenAddress} not found in database`);
            return 0;
        }

        let price = await priceService.getByTokenAndDate(tokenAddress, symbol, PRICE_CURRENCY_SYMBOL, date);
        if (!price) {
            console.error(`Price for token ${tokenAddress} not found in database`);
            return 0;
        }

        return price.price
    } catch (e) {
        console.error("Load price from database error", e.toString());
    }
    return 0;
}

async function fetchTokenPricesInBatches(tokenAddresses, batchSize = 100) {
    const chunkArray = (arr, size) =>
        Array.from({
                length: Math.ceil(arr.length / size)
            }, (v, i) =>
                arr.slice(i * size, i * size + size)
        );

    const addressBatches = chunkArray(tokenAddresses, batchSize);

    const fetchPromises = addressBatches.map(batch => {
        const url = `https://api.dev.dex.guru/v1/chain/1/tokens/market?token_addresses=${batch.join('%2C')}&order=asc&limit=100&offset=0`;
        return axiosDexguru.get(url);
    });

    const results = await Promise.allSettled(fetchPromises);
    const prices = {};
    const volumes = {};
    const liquidities = {};

    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.data.data) {
            result.value.data.data.forEach(item => {
                console.log((item.price_usd * result.value.data.data.length) < (3 * item.liquidity), item.price_usd, result.value.data.data.length, item.liquidity, item.liquidity_usd);
                // prices[item.address] = (item.price_usd * result.value.data.data.length) < (3 * item.liquidity) ? 0 : item.price_usd;
                volumes[item.address] = item.volume_24h_usd;
                prices[item.address] = item.price_usd;
                liquidities[item.address] = item.liquidity_usd;
            });
        }
    });

    return {
        prices,
        volumes,
        liquidities
    };
}

async function initIsNotExistingToken(tokenAddress) {
    let token = await tokenService.getByAddressAndChain(tokenAddress, TOKEN_CHAIN);
    if (token) {
        return true;
    }

    let startDate = moment(new Date()).subtract(PRICE_TO_UPDATE_LAST_DAYS, 'days').toDate();
    let tokenInfo = await covalentService.getTokenWithPrices(tokenAddress, PRICE_CURRENCY_SYMBOL, startDate);
    if (!tokenInfo) {
        console.error(`Token ${tokenAddress} not found in covalent or database`);
        return false;
    }

    token = await tokenService.add(
        ['address', 'symbol', 'chain', 'decimals'],
        [tokenInfo.contract_address, tokenInfo.contract_ticker_symbol, TOKEN_CHAIN, tokenInfo.contract_decimals]
    );

    if (!isExistPricesData(tokenInfo.prices)) {
        let price = await bitqueryService.getTokenPrices(tokenAddress, moment(new Date()).subtract(PRICE_TO_UPDATE_LAST_DAYS, 'days'), new Date());
        await updateTokenFixedPrices(token, price);
        return true;
    }
    await updateTokenPrices(token, tokenInfo.prices);
}

async function assignPricesToTrades(transformedData, allDataResults) {
    let minTimestamp = Number.MAX_SAFE_INTEGER;
    let maxTimestamp = Number.MIN_SAFE_INTEGER;

    for (const transactions of Object.values(transformedData)) {
        for (const {timestamp} of transactions) {
            minTimestamp = Math.min(minTimestamp, timestamp);
            maxTimestamp = Math.max(maxTimestamp, timestamp);
        }
    }

    minTimestamp--;
    maxTimestamp++;

    await updateKlineCSV(minTimestamp, maxTimestamp);

    const filePath = './svcs/blob.csv';
    const parsedKlines = [];

    const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity
    });

    rl.on('line', (line) => {
        parsedKlines.push(line);
    });

    rl.on('close', () => {
        console.log(parsedKlines[0]);
    });


    const tokenAddresses = new Set();// key  address value symbol
    for (const transactions of Object.values(transformedData)) {
        for (const transaction of transactions) {
            const tokens = [...transaction.tokens_in, ...transaction.tokens_out];
            for (const token of tokens) {
                tokenAddresses.add(token.address);
            }
        }
    }

    console.log("tokenAddresses size: ", tokenAddresses.size);

    for (const tokenAddress of tokenAddresses) {
        let tokenInit = await initIsNotExistingToken(tokenAddress);
        if (!tokenInit) {
            console.error(`Token ${tokenAddress} not found in database`);
        }
    }


    await updateTokensPrices();

    //
    // for (const transactions of Object.values(transformedData)) {
    //     for (const transaction of transactions) {
    //         if (transaction.direction === "convert") {
    //             const tokens = [...transaction.tokens_in, ...transaction.tokens_out];
    //             const pricesUpdated = await Promise.all(
    //                 tokens.map(token => getTokenPrice(token.address, token.symbol, new Date(transaction.timestamp * 1000)))
    //             );
    //
    //             tokens.forEach((token, index) => {
    //                 token.price_usd = pricesUpdated[index];
    //             });
    //
    //             if (tokens.some(token => !token.price_usd)) {
    //                 transaction.direction = "ineligible";
    //             }
    //         }
    //     }
    // }
    //
    // for (const transactions of Object.values(transformedData)) {
    //     for (const transaction of transactions) {
    //         const tokens = [...transaction.tokens_in, ...transaction.tokens_out];
    //
    //         await Promise.all(tokens.map(async (token) => {
    //             if (stablecoins.includes(token.address)) {
    //                 token.price_usd = 1;
    //             } else if (token.address === wrappedEther) {
    //                 try {
    //                     // token.price_usd = await findAveragePriceByTimestamp(transaction.timestamp, parsedKlines);
    //                     token.price_usd = await getTokenPrice(token.address, token.symbol, new Date(transaction.timestamp * 1000));
    //                 } catch (error) {
    //                     console.error('Error finding average price by timestamp:', error.message);
    //                     token.price_usd = 0;
    //                 }
    //             }
    //         }));
    //     }
    // }
}


module.exports = {
    PRICE_CURRENCY_SYMBOL,
    updateKlineCSV,
    findAveragePriceByTimestamp,
    getTokenPrice,
    updateTokensPrices,
    fetchTokenPricesInBatches,
    assignPricesToTrades
}
