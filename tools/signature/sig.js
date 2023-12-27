require('dotenv').config(); // Load environment variables from .env file
const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const endpointV1 = 'https://graphql.bitquery.io';
const endpointV2 = 'https://streaming.bitquery.io/graphql';

// Create an Axios instance for BitQuery
const axiosBitquery = rateLimit(axios.create({
  headers: {
    'X-API-KEY': process.env.BITQUERY_API_KEY
  }
}), {
  maxRequests: process.env.BITQUERY_MAX_REQUESTS,
  perMilliseconds: process.env.BITQUERY_REQUEST_INTERVAL_MS
});

// Function to execute GraphQL queries
async function executeGraphQLQuery(endpoint, query, parameters) {
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

// Function to fetch Ethereum transactions
async function fetchEthereumTransactions() {
    const query = `
    query MyQuery {
        EVM(network: eth, dataset: combined) {
            Calls(
                where: {Transaction: {To: {is: "0x62b5D0314e4D50c629Dfcf5CD3B4546dC6c045f0"}}, Call: {Signature: {SignatureHash: {is: "0xa1597a17"}}}}
            ) {
                Call {
                    Signature {
                        SignatureHash
                    }
                }
                Transaction {
                    Hash
                }
            }
        }
    }
    `;

    return executeGraphQLQuery(endpointV2, query, {});
}

// Function to fetch all transfers for a transaction hash
async function fetchTransfers(hashes) {
    const chunkSize = 100; // Define the size of each chunk
    let allTransfers = [];

    for (let i = 0; i < hashes.length; i += chunkSize) {
        const chunk = hashes.slice(i, i + chunkSize); // Get a chunk of hashes
        const query = `query MyQuery($hashes: [String!]!) {
            ethereum(network: ethereum) {
                transfers(options: {limit: 25000}, any: {txHash: {in: $hashes}}) {
                    receiver {
                        address
                    }
                }
            }
        }`;

        const variables = {
            hashes: chunk
        };

        // Execute the query for the current chunk of hashes
        const response = await executeGraphQLQuery(endpointV1, query, variables);
        if (response && response.data.ethereum && response.data.ethereum.transfers) {
            allTransfers.push(...response.data.ethereum.transfers);
        }
		debugger;
    }

    return { ethereum: { transfers: allTransfers } };
}


// Function to check if an address is an EOA or a smart contract
async function isContract(addresses) {
    const chunkSize = 100; // Define the size of each chunk
    let allAddressInfo = [];

    for (let i = 0; i < addresses.length; i += chunkSize) {
        const chunk = addresses.slice(i, i + chunkSize); // Get a chunk of addresses
        const query = `
        query MyQuery($addresses: [String!]!) {
            ethereum(network: ethereum) {
                address(address: {in: $addresses}) {
                    address
                    smartContract {
                        contractType
                        protocolType
                    }
                    annotation
                }
            }
        }`;

        const variables = {
            addresses: chunk
        };

        // Execute the query for the current chunk of addresses
        const response = await executeGraphQLQuery(endpointV1, query, variables);
        if (response && response.data.ethereum && response.data.ethereum.address) {
            allAddressInfo.push(...response.data.ethereum.address);
        }
    }

    return { ethereum: { address: allAddressInfo } };
}


async function main() {
    const transactionData = await fetchEthereumTransactions();
    if (!transactionData || !transactionData.data.EVM.Calls) {
        console.log("No transaction data found.");
        return;
    }

    // Collect all transaction hashes
    let hashes = transactionData.data.EVM.Calls.map(tx => tx.Transaction.Hash);

    // Fetch transfers for all transaction hashes
    const transfersData = await fetchTransfers(hashes);
    if (!transfersData || !transfersData.ethereum.transfers) {
        console.log("No transfer data found.");
        return;
    }

    // Collect unique receiver addresses
    let receiverAddresses = new Set();
    transfersData.ethereum.transfers.forEach(transfer => {
        receiverAddresses.add(transfer.receiver.address);
    });

    // Convert Set to Array
    receiverAddresses = Array.from(receiverAddresses);

    // Check if the receiver addresses are EOAs or smart contracts
    const addressesInfo = await isContract(receiverAddresses);
    if (!addressesInfo || !addressesInfo.ethereum.address) {
        console.log("No address info found.");
        return;
    }
	debugger;

    // Log the results
    addressesInfo.ethereum.address.forEach(addrInfo => {
        const isEOA = addrInfo.smartContract === null;
        console.log(`Address: ${addrInfo.address}, is EOA: ${isEOA}`);
    });
}

main();
