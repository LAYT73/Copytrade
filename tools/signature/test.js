const { axiosWeb3 } = require('./axiosConfig'); // adjust the path to your axiosConfig file
const Web3 = require('web3');
// Array of addresses
const addresses = ["0x1355474d71db10cf4c7ba0682e9b03e05737edfd",
"0x9de131992e79119214445f29973d75d1ed713d7d",
"0xeb509c2a67efd689119fb338f7b1118e29c67027"];

// Function to call the view function 'name' for an address
async function callViewFunction(address) {
  try {
    const response = await axiosWeb3.post('/', {
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{
        to: address,
        data: '0x06fdde03' // The 'name' function selector
      }, 'latest'],
      id: 1
    });

    // Assuming response is in hex format, convert it to string
    const name = response.data.result ? Web3.utils.toAscii(response.data.result).replace(/\u0000/g, '') : 'Unknown';
    console.log(`Name for ${address}: ${name}`);
  } catch (error) {
    console.error(`Error querying ${address}: ${error.message}`);
  }
}

// Query all addresses concurrently
async function queryAddresses() {
  const promises = addresses.map(address => callViewFunction(address));
  await Promise.all(promises);
}

// Run the queries
queryAddresses().catch(console.error);
