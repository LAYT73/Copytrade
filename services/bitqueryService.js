const {axiosBitquery} = require("../utils/axiosConfig");

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

async function getTokenPrices(address, startDate, endDate) {
    try {
        const endpoint = 'https://graphql.bitquery.io';
        const query = `query MyQuery($address: String!, $from: ISO8601DateTime, $till: ISO8601DateTime) {
        ethereum(network: ethereum) {
          dexTrades(
            options: {limit: 100, asc: "timeInterval.minute"}
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

        const parameters = {
            address: address,
            from: startDate.toISOString(),
            till: endDate.toISOString()
        };

        console.log('parameters', parameters)
        const bitQueryResponse = await callBitqueryAPI(endpoint, query, parameters);

        // console.log(dexGuruResponse.data.data);
        // console.log(bitQueryResponse.data.ethereum.dexTrades, iso8601DateTime, timestamp);
        console.log(bitQueryResponse.data.ethereum)
        if (bitQueryResponse.data && bitQueryResponse.data.ethereum.dexTrades.length > 0 && parseFloat(bitQueryResponse.data.ethereum.dexTrades[0].averagePriceInUSD) !== 0) {
            console.log(bitQueryResponse.data.ethereum.dexTrades)
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
        console.error(error);
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

// add export
module.exports = {
    getTokenPrices,
    callBitqueryAPI
};
