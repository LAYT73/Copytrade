const fs = require('fs');
const readline = require('readline');
const csv = require('fast-csv');
const stablecoins = process.env.STABLECOINS.split(',');
const wrappedEther = process.env.WRAPPEDETHER;
const {axiosBinance, axiosMoralis, axiosDexguru, axiosBitquery} = require('../utils/axiosConfig');
const { log } = require('console');
const { CovalentClient } = require("@covalenthq/client-sdk");

PRICE_MAP = {} // {tokenAddress: {price, lastUpdateDate}}
const PRICE_CACHE_UPDATE_TIME = 24 * 1000 * 60 * 60; // 24 hours in milliseconds

async function callBitqueryAPI(endpoint, query, parameters) {
  try {
    const response = await axiosBitquery.post(endpoint, {
      query,
      variables: parameters
    });
    return response.data;
  } catch (error) {
    console.error('Error in callBitqueryAPI:', error);
    throw error;
  }
}

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

    const response = await axiosBinance.get(url, { params });
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

async function getTokenPrice(tokenAddress, timestamp, block) {
    let now = new Date();

    let lastTokenPrice = PRICE_MAP[tokenAddress];
    if (lastTokenPrice && lastTokenPrice.lastUpdateDate) {
        let lastUpdateDate = PRICE_MAP[tokenAddress].lastUpdateDate;
        let timeDifference = now - new Date(lastUpdateDate);
        if (timeDifference <= PRICE_CACHE_UPDATE_TIME) {
            let price = PRICE_MAP[tokenAddress].price;
            console.log("CACHED PRICE: ", price)
            return price;
        }
    }

    try {
       const client = new CovalentClient("ckey_be6ae76a05f940e1aae6adc7540");
       const resp = await client.PricingService.getTokenPrices("eth-mainnet","usd", tokenAddress);
       console.log("resp.data: ", resp.data && !!resp.data.length);
       if (resp.data.length && resp.data[0].prices && resp.data[0].prices.length) {
           let price = resp.data[0].prices[0].price;
           console.log(`Price found. Token ${tokenAddress}, Price Usd: ${price}`);
           PRICE_MAP[tokenAddress] = {
               price: price,
               lastUpdateDate: now
           }
           return price;
       }
   } catch (e) {
       console.error("Load price from CovalentApi error", e.toString());
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

async function assignPricesToTrades(transformedData, allDataResults) {
  let minTimestamp = Number.MAX_SAFE_INTEGER;
  let maxTimestamp = Number.MIN_SAFE_INTEGER;

  for (const transactions of Object.values(transformedData)) {
    for (const { timestamp } of transactions) {
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


  for (const transactions of Object.values(transformedData)) {
    for (const transaction of transactions) {
      if (transaction.direction === "convert") {
        const tokens = [...transaction.tokens_in, ...transaction.tokens_out];
        const pricesUpdated = await Promise.all(
          tokens.map(token => getTokenPrice(token.address, transaction.timestamp, transaction.block))
        );

        tokens.forEach((token, index) => {
          token.price_usd = pricesUpdated[index];
        });

        if (tokens.some(token => !token.price_usd)) {
          transaction.direction = "ineligible";
        }
      }
    }
  }

  for (const transactions of Object.values(transformedData)) {
    for (const transaction of transactions) {
      const tokens = [...transaction.tokens_in, ...transaction.tokens_out];

      await Promise.all(tokens.map(async (token) => {
        if (stablecoins.includes(token.address)) {
          token.price_usd = 1;
        } else if (token.address === wrappedEther) {
          try {
            token.price_usd = await findAveragePriceByTimestamp(transaction.timestamp, parsedKlines);
          } catch (error) {
            console.error('Error finding average price by timestamp:', error.message);
            token.price_usd = 0;
          }
        }
      }));
    }
  }
}


  module.exports = {updateKlineCSV, findAveragePriceByTimestamp, getTokenPrice, fetchTokenPricesInBatches, assignPricesToTrades}
