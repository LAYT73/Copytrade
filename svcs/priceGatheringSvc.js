const fs = require('fs');
const readline = require('readline');
const csv = require('fast-csv');
const {axiosBinance, axiosMoralis, axiosDexguru, axiosBitquery} = require('../utils/axiosConfig'); 
const stablecoins = process.env.STABLECOINS.split(',');
const wrappedEther = process.env.WRAPPEDETHER;

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

async function getTokenPrice(address, timestamp, block) {
  try {
      const endpoint = 'https://graphql.bitquery.io';
      const query = `query MyQuery($address: String!, $from: ISO8601DateTime, $till: ISO8601DateTime) {
        ethereum(network: ethereum) {
          dexTrades(
            options: {limit: 6, asc: "timeInterval.minute"}
            time: {since: $from, till: $till}
            baseCurrency: {is: $address}
          ) {
            timeInterval {
              minute(count:1440)
            }
            tradeIndex
            protocol
            exchange {
              fullName
            }
            baseCurrency {
              symbol
              address
            }
            baseAmount
            baseAmountInUSD: baseAmount(in: USD)
            quoteCurrency {
              symbol
              address
            }
            quoteAmount
            quoteAmountInUSD: quoteAmount(in: USD)
            trades: count
            quotePrice
            average_price: quotePrice(calculate: average)
            maximum_price: quotePrice(calculate: maximum)
            minimum_price: quotePrice(calculate: minimum)
            open_price: minimum(of: block, get: quote_price)
            close_price: maximum(of: block, get: quote_price)
            averagePriceInUSD: expression(get: "quoteAmountInUSD/baseAmount")
          }
        }
      }
      `;
      
      const milliseconds = timestamp * 1000;
      const date = new Date(milliseconds);
      const iso8601DateTime = date.toISOString();
      
      const parameters = {
        address: address,
        from: iso8601DateTime,
        till: iso8601DateTime,
      };
  
      const bitQueryResponse = await callBitqueryAPI(endpoint, query, parameters);

      // console.log(dexGuruResponse.data.data);
      // console.log(bitQueryResponse.data.ethereum.dexTrades, iso8601DateTime, timestamp);
      if (bitQueryResponse.data && bitQueryResponse.data.ethereum.dexTrades.length > 0 && parseFloat(bitQueryResponse.data.ethereum.dexTrades[0].averagePriceInUSD) !== 0) {
          return parseFloat(bitQueryResponse.data.ethereum.dexTrades[0].averagePriceInUSD);
      } else {
          throw new Error('BitQuery price invalid');
      }

      // if (dexGuruResponse.data && dexGuruResponse.data.data.length > 0 && dexGuruResponse.data.data[0].price_usd !== 0) {
      //     return dexGuruResponse.data.data[0].price_usd;
      // } else {
      //     // If DexGuru failed, fallback to Moralis
      //     throw new Error('DexGuru price invalid');
      // }
  } catch (error) {
  //     // If DexGuru fails, try Moralis
  //     try {
  //         const moralisResponse = await axiosMoralis.get(`https://deep-index.moralis.io/api/v2.2/erc20/${address}/price`, {
  //             params: {
  //                 chain: 'eth',
  //                 to_block: block,
  //             },
  //         });

  //         if (moralisResponse.data && moralisResponse.data.usdPrice !== 0) {
  //             return moralisResponse.data.usdPrice;
  //         } else {
  //             throw new Error('Moralis price invalid');
  //         }
  //     } catch (fallbackError) {
  //         console.error(fallbackError);
          console.log(`${address} price on bitquery is 0`);
          return 0;
      // }
  }
}

async function fetchTokenPricesInBatches(tokenAddresses, batchSize = 100) {
  // Function to split the array of addresses into chunks
  const chunkArray = (arr, size) =>
      Array.from({
              length: Math.ceil(arr.length / size)
          }, (v, i) =>
          arr.slice(i * size, i * size + size)
      );

  // Split the tokenAddresses into batches
  const addressBatches = chunkArray(tokenAddresses, batchSize);
  console.log(addressBatches);
  // Map each batch to a fetch promise and execute in parallel
  const fetchPromises = addressBatches.map(batch => {
      const url = `https://api.dev.dex.guru/v1/chain/1/tokens/market?token_addresses=${batch.join('%2C')}&order=asc&limit=100&offset=0`;
      return axiosDexguru.get(url);
  });

  // Await all fetch promises in parallel
  const results = await Promise.allSettled(fetchPromises);
  const prices = {};
  const volumes = {};
  const liquidities = {};

  // Process each result
  results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.data.data) {
          result.value.data.data.forEach(item => {
              prices[item.address] = item.price_usd;
              volumes[item.address] = item.volume_24h_usd;
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
    // Process the parsedKlines array
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
        
        if (tokens.some(token => token.price_usd === 0)) {
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