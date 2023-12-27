require('dotenv').config();
const stablecoins = process.env.STABLECOINS.split(',');
const wrappedEther = process.env.WRAPPEDETHER;
const { axiosWeb3, axiosBitquery } = require('./axiosConfig'); // Merged axiosWeb3 and axiosBitquery imports
const Web3 = require('web3');
const { smartContractType, buyersOfTokens } = require('./queries'); // Removed unused queries
const { callBitqueryAPI } = require('./bitQuerySvc'); // Removed unused functions

// Refactored for clarity and efficiency
function batchAddressesWithParameters(addresses, startDate, endDate, batchSize = 100) {
  return Array.from({ length: Math.ceil(addresses.length / batchSize) }, (_, i) => {
    const batchStartIndex = i * batchSize;
    return {
      parameters: {
        limit: 25000,
        offset: 0,
        network: "ethereum",
        addresses: addresses.slice(batchStartIndex, batchStartIndex + batchSize),
        from: startDate,
        till: endDate
      },
      count: -1
    };
  });
}

// Corrected the callBitqueryAPI function call and added a missing parameter
async function fetchDataForBatches(addresses, startDate, endDate) {
  const batchedParams = batchAddressesWithParameters(addresses, startDate, endDate);
  let allData = [];

  for (const batchParams of batchedParams) {     
    try {
      const response = await callBitqueryAPI(smartContractType.endpoint, smartContractType.query, batchParams.parameters);
      allData = allData.concat(response.data.ethereum[Object.keys(response.data.ethereum)[0]]);
    } catch (error) {
      console.error('Error fetching data for batch:', error);
    }
  }

  return allData;
}


async function fetchUniswapPairTokens(pairAddress) {
    const TOKEN0_METHOD = '0x0dfe1681';
    const TOKEN1_METHOD = '0xd21220a7';

    try {
        // Fetch token0
        let response = await axiosWeb3.post('', {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{
                to: pairAddress,
                data: TOKEN0_METHOD
            }, 'latest']
        });

        let token0Address = response.data.result;
        if (!token0Address || token0Address === '0x') {
            return null; // Method not found on contract
        }

        // Normalize token address
        token0Address = '0x' + token0Address.slice(26).toLowerCase();

        // Check if token0 is a stablecoin or wrapped ether
        if (stablecoins.includes(token0Address) || token0Address === wrappedEther) {
            // Fetch token1
            response = await axiosWeb3.post('', {
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_call',
                params: [{
                    to: pairAddress,
                    data: TOKEN1_METHOD
                }, 'latest']
            });

            let token1Address = response.data.result;
            if (!token1Address || token1Address === '0x') {
                return null; // Method not found on contract
            }

            // Normalize token address
            token1Address = '0x' + token1Address.slice(26).toLowerCase();
            return token1Address;
        }

        return token0Address;
    } catch (error) {
        console.error('Error fetching tokens:', error);
        return null;
    }
}

async function fetchBuyersOfToken(tokenAddress, dateString) {
    const endDate = new Date(dateString);
    endDate.setSeconds(endDate.getSeconds() - 180); // Adjusting timestamp
    const startDate = new Date(endDate);
    startDate.setHours(endDate.getHours() - 2080);
  
    let hasMorePages = true;
    let offset = 0;
    const limit = 25000; // Define a reasonable limit for each page
    const walletsFound = [];
  
    while (hasMorePages) {
      const parameters = {
        tokens: [tokenAddress], // Token contract address for filtering
        limit: limit,
        offset: offset,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      };
  
      const response = await axiosBitquery.post(buyersOfTokens.endpoint, {
        query: buyersOfTokens.query,
        variables: parameters
      });
      const transfers = response.data.data.ethereum[Object.keys(response.data.data.ethereum)[0]];
      if (transfers.length < limit) {
        console.log(transfers.length);
        hasMorePages = false;
      }
  
      transfers.forEach(transfer => {
        if (transfer.transaction.txFrom.address === transfer.receiver.address) {
          walletsFound.push(transfer.receiver.address);
        }
      });
  
      offset += limit;
    }
  
    return walletsFound;
  }
  

module.exports = { batchAddressesWithParameters, fetchDataForBatches, fetchUniswapPairTokens, fetchBuyersOfToken };
