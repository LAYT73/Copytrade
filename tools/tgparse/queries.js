const endpointV1 = 'https://graphql.bitquery.io';
const endpointV2 = 'https://streaming.bitquery.io/graphql';

const transfersByAdressesCount = 
{
  endpoint: endpointV1,
  query: `query ($network: EthereumNetwork!, $addresses: [String!]!, $from: ISO8601DateTime, $till: ISO8601DateTime) {
  ethereum(network: $network) {
    transfers(
      date: {since: $from, till: $till}
      txFrom: {in: $addresses}
      success: true
    ) {
      count
    }
  }
}
`
}

const transfersByAdresses = {
  endpoint: endpointV1,
  query: `query ($network: EthereumNetwork!, $addresses: [String!]!, $from: ISO8601DateTime, $till: ISO8601DateTime, $limit: Int!, $offset: Int!) {
    ethereum(network: $network) {
      transfers(
        date: {since: $from, till: $till}
        options: {limit: $limit, offset: $offset, asc: "block.timestamp.unixtime"}
        txFrom: {in: $addresses}
        success: true
      ) {
        transaction {
          hash
          txFrom {
            address
          }
        }
      amount
      amountUSD: amount(in: USD)
        currency {
          address
          symbol
          decimals
          name
          tokenType
        }
        receiver {
          address
        }
        sender {
          address
        }
        block {
          timestamp {
            unixtime
          }
          height
        }
        gasValue
        gasCostUSD: gasValue(in: USD)
      }
    }
  }
`
}

const buyersOfTokens = {
  endpoint: endpointV1,
  query: `query MyQuery($tokens: [String!]!, $limit: Int!, $offset: Int!) {
    ethereum(network: ethereum) {
      transfers(
        options: {limit: $limit, offset: $offset, asc: "block.timestamp.unixtime"}
        currency: {in: $tokens}
      ) {
        transaction {
          txFrom {
            address
          }
        }
        receiver {
          address
        }
        block {
          timestamp {
            unixtime
          }
        }
      }
    }
  } 
`
};

const smartContractType = {
  endpoint: endpointV1,
  query: `query MyQuery($addresses: [String!]!) {
  ethereum(network: ethereum) {
    address(address: {in: $addresses}) {
      address
      smartContract {
        contractType
        protocolType
        currency {
          name
        }
      }
    }
  }
}
`
};

module.exports = { transfersByAdressesCount, transfersByAdresses, buyersOfTokens, smartContractType };
