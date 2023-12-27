require('dotenv').config();
const stablecoins = process.env.STABLECOINS.split(',');
const wrappedEther = process.env.WRAPPEDETHER;
const { axiosWeb3 } = require('./axiosConfig');
const { axiosBitquery } = require('./axiosConfig');
const Web3 = require('web3');
const { transfersByAdressesCount, transfersByAdresses, smartContractType } = require('./queries');
const {  prefetchDataLengthFromBitQuery, callBitqueryAPI, fetchDataInParallel} = require('./bitQuerySvc');
// console.log(smartContractType);
const { fetchDataForBatches, fetchUniswapPairTokens, fetchBuyersOfToken } = require('./fetchData');
const fs = require('fs');


// Get an array of the object keys



// Read the file
const rawData = fs.readFileSync('updatedContracts.json');

// Parse the JSON data
const updatedContracts = JSON.parse(rawData);
// Example usage
(async () => {
    // const updatedContracts = await processContracts(data);
    let walletCounts = {};
    let currentContract = 0;
    
    const totalContracts = Object.keys(updatedContracts).length;

    for (const [address, dateString] of Object.entries(updatedContracts)) {
        currentContract++;
        console.log(`Processing contract ${currentContract} out of ${totalContracts}`);

        let results = await fetchBuyersOfToken(address, dateString);
        results = [...new Set(results)]; // Remove duplicates
    
        // Increment counts directly
        results.forEach(wallet => {
            walletCounts[wallet] = (walletCounts[wallet] || 0) + 1;
        });
    }
    
    // Remove entries with counts less than 3
    for (const wallet in walletCounts) {
        if (walletCounts[wallet] < 3) {
            delete walletCounts[wallet];
        }
    }
    
    // Convert to array, sort in descending order, and convert back to object
    walletCounts = Object.fromEntries(
        Object.entries(walletCounts)
        .sort((a, b) => b[1] - a[1])
    );
    
    // walletCounts now contains sorted wallet addresses with counts >= 3   
    // Save to a JSON file
    const tgName = 't.me-chonggouriji'; // Replace with your desired name
    const numberOfTokens = Object.keys(updatedContracts).length;
    const filename = `${tgName}---${numberOfTokens}_tokens.json`;
    debugger;
    fs.writeFileSync(filename, JSON.stringify(walletCounts, null, 2));
    console.log(`Saved results to ${filename}`);
})();