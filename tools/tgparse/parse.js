const {checkAndProcessFiles} = require('./parsehtml');
const { fetchDataForBatches, fetchUniswapPairTokens, fetchBuyersOfToken } = require('./fetchData');
const fs = require('fs');
const stablecoins = process.env.STABLECOINS.split(',');
const wrappedEther = process.env.WRAPPEDETHER;

async function processContracts(contractsWithDates) {
    const contractAddresses = Object.keys(contractsWithDates);
    const contractTypes = await queryContractTypes(contractsWithDates); 

    let counter = 0;    

    for (const address of contractAddresses) {
        counter++;
        console.log(`Processing contract ${counter} out of ${contractAddresses.length}`);
        const contractType = contractTypes[address];
        const date = contractsWithDates[address];
        

        if (contractType && contractType.toLowerCase() === 'token') {
            contractsWithDates[address] = date;
        }

        if (contractType && contractType.toLowerCase() === 'dex') {
            const newTokenAddress = await fetchUniswapPairTokens(address);
            if (newTokenAddress && !stablecoins.includes(newTokenAddress) && newTokenAddress !== wrappedEther) {
                delete contractsWithDates[address];
                contractsWithDates[newTokenAddress] = date; // Replace with new token address
            } else {
                delete contractsWithDates[address]; // Delete if null or a stablecoin/wrapped ether
            }
        } else {
            delete contractsWithDates[address]; // Not a token or dex, delete it
        }
    }

    return contractsWithDates;
}

async function queryContractTypes(contractsWithDates) {
    // Extract the addresses from the keys of contractsWithDates
    const addresses = Object.keys(contractsWithDates);
  
    // Use any dates for startDate and endDate
    const startDate = '2021-01-01';
    const endDate = '2021-12-31';
  
    // Fetch data for batches
    const output = await fetchDataForBatches(addresses, startDate, endDate);
    
  
    // Map the returned array to an object where the keys are the addresses and the values are the contract types
    const contractTypes = output.reduce((obj, item) => {
      obj[item.address] = item.smartContract ? item.smartContract.contractType : null;
      return obj;
    }, {});
    return contractTypes;
  }

const directoryPath = './';
const baseFilename = 'messages';

(async () => {
    try {
      const data = await checkAndProcessFiles(directoryPath, baseFilename);
      const updatedContracts = await processContracts(data);

      // Save updatedContracts to a JSON file
      fs.writeFileSync('updatedContracts.json', JSON.stringify(updatedContracts, null, 2));
    } catch (error) {
      console.error(error);
    }
  })();