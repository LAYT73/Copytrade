const {axiosBitquery} = require('../utils/axiosConfig'); 
const { addressesCmd } = require('./addressesCmd');

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

async function buyersCmd(ctx) {
    const inputText = ctx.message.text;	
    const inputArray = inputText.split(' ');
    const days = +inputArray[2];
    const address = inputArray[1];

    const currentDate = new Date();

    const endDate = new Date(currentDate);
    endDate.setDate(currentDate.getDate() - days);

    const currentDateString = currentDate.toISOString();
    const endDateString = endDate.toISOString();

    console.log("Текущая дата:", currentDateString);
    console.log("Дата ", days, "дней назад:", endDateString);
    const query = `{
        EVM(dataset: combined, network: eth) {
          buyside: DEXTrades(
            orderBy: {descending: Block_Time}
            where: {Trade: {Buy: {Currency: {SmartContract: {is: "${address}"}}}}, Block: {Time: {since: "${endDateString}", till: "${currentDateString}"}}}
          ) {
            Block {
              Number
              Time
            }
            Transaction {
              From
              To
              Hash
            }
            Trade {
              Buy {
                Amount
                Buyer
                Currency {
                  Name
                  Symbol
                  SmartContract
                }
                Seller
                Price
              }
              Sell {
                Amount
                Buyer
                Currency {
                  Name
                  SmartContract
                  Symbol
                }
                Seller
                Price
              }
            }
          }
          sellside: DEXTrades(
            orderBy: {descending: Block_Time}
            where: {Trade: {Sell: {Currency: {SmartContract: {is: "${address}"}}}}, Block: {Time: {since: "${endDateString}", till: "${currentDateString}"}}}
          ) {
            Block {
              Number
              Time
            }
            Transaction {
              From
              To
              Hash
            }
            Trade {
              Buy {
                Amount
                Buyer
                Currency {
                  Name
                  Symbol
                  SmartContract
                }
                Seller
                Price
              }
              Sell {
                Amount
                Buyer
                Currency {
                  Name
                  SmartContract
                  Symbol
                }
                Seller
                Price
              }
            }
          }
        }
      }
    `
    const response = await callBitqueryAPI('https://streaming.bitquery.io/graphql', query, {});
    const sellsideAddresses = response.data.EVM.sellside.map(item => item.Transaction.From);
    const buysideAddresses = response.data.EVM.buyside.map(item => item.Transaction.From);
    const addresses = [...sellsideAddresses, ...buysideAddresses];

    ctx.message.text = '/addresses '+ addresses.join(' ') + ' ' + days;
    addressesCmd(ctx);
}

module.exports = { buyersCmd };
