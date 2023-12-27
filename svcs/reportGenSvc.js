require('dotenv').config();
const stablecoins = process.env.STABLECOINS.split(',');
const wrappedEther = process.env.WRAPPEDETHER;
const BigNumber = require('bignumber.js');

function transformData(transfersArray) {
    let hashGrouped = {};
  
    // Process each transfer to group by transaction hash
    transfersArray.forEach(transfer => {
      const txHash = transfer.transaction.hash;
  
      if (!hashGrouped[txHash]) {
        hashGrouped[txHash] = {
          transaction: {
            hash: txHash,
            txFrom: transfer.transaction.txFrom
          },
          gasValue: transfer.gasValue,
          gasCostUSD: transfer.gasCostUSD,
          block: transfer.block,
          transfers: []
        };
      } else {
        // Update with the max gasValue and gasCostUSD
        hashGrouped[txHash].gasValue = Math.max(hashGrouped[txHash].gasValue, transfer.gasValue);
        hashGrouped[txHash].gasCostUSD = Math.max(hashGrouped[txHash].gasCostUSD, transfer.gasCostUSD);
      }
  
      // Add the current transfer to the group
      hashGrouped[txHash].transfers.push({
        amount: transfer.amount,
        currency: {
          address: transfer.currency.address,
          symbol: transfer.currency.symbol,
          decimals: transfer.currency.decimals,
          name: transfer.currency.name,
          tokenId: transfer.currency.tokenId
        },
        receiver: {
          address: transfer.receiver.address
        },
        sender: {
          address: transfer.sender.address
        }
      });
    });
  
    // Group by txFrom address
    let addressGrouped = {};
  
    Object.values(hashGrouped).forEach(group => {
      const txFromAddress = group.transaction.txFrom.address;
  
      if (!addressGrouped[txFromAddress]) {
        addressGrouped[txFromAddress] = [];
      }
  
      addressGrouped[txFromAddress].push(group);
    });
  
    return addressGrouped;
  }


function createTradeObject(userAddress, originalData) {

  ///
  function summarizeTokens(tokens, amountKey) {
      return tokens.reduce((acc, token) => {
        let existingToken = acc.find(t => t.address === token.address);
        if (existingToken) {
          // Sum amounts using BigNumber and convert back to string
          existingToken[amountKey] = new BigNumber(existingToken[amountKey]).plus(token[amountKey]).toString();
          existingToken.amount = new BigNumber(existingToken.amount).plus(token.amount).toString();
        } else {
          // Make sure to convert amounts to BigNumber initially
          token[amountKey] = new BigNumber(token[amountKey]).toString();
          token.amount = new BigNumber(token.amount).toString();
          acc.push(token);
        }
        return acc;
      }, []);
    }

    function handleTokenChange(tokensIn, tokensOut) {
      tokensIn.forEach(tokenIn => {
        let tokenOutIndex = tokensOut.findIndex(tokenOut => tokenOut.address === tokenIn.address);
        if (tokenOutIndex > -1) {
          let tokenOut = tokensOut[tokenOutIndex];
          // Subtract 'amount_out' from 'amount_in' and update 'amount'
          let newAmountIn = new BigNumber(tokenIn.amount_in).minus(tokenOut.amount_out);
          tokenIn.amount_in = newAmountIn.toString();
          tokenIn.amount = newAmountIn.toString();
          
          // Remove the token from tokens_out since it was used as 'change'
          tokensOut.splice(tokenOutIndex, 1);
        }
      });
    }
    
    function isValidTrade(trade) {
      // Check if there's exactly one token in each of the tokens_in and tokens_out arrays
      if (trade.tokens_in.length !== 1 || trade.tokens_out.length !== 1) {
          return false;
      }

      // Use BigNumber to ensure amounts are greater than zero
      if (new BigNumber(trade.tokens_in[0].amount_in).isLessThanOrEqualTo(0) ||
																									
								   
													
																		 
          new BigNumber(trade.tokens_out[0].amount_out).isLessThanOrEqualTo(0)) {
          return false;
													
	  
																	  
													 
												 
			 
		   
		   
      }
	   

      // If both checks pass, the trade is valid
      return true;
  }
  function determineTradeDirection(trade) {
      const tokenIns = new Set(trade.tokens_in.map(t => t.address));
      const tokenOuts = new Set(trade.tokens_out.map(t => t.address));
  
      const stablecoinOrEtherIn = Array.from(tokenIns).every(t => stablecoins.includes(t) || wrappedEther.includes(t));
      const stablecoinOrEtherOut = Array.from(tokenOuts).every(t => stablecoins.includes(t) || wrappedEther.includes(t));
  
      if (tokenIns.size > 1 || tokenOuts.size > 1) {
          return 'ineligible';
      } else if (stablecoinOrEtherIn && stablecoinOrEtherOut) {
          return 'blank';
      } else if (stablecoinOrEtherIn) {
          return 'buy';
      } else if (stablecoinOrEtherOut) {
          return 'sell';
      } else {
          return 'convert';
      }
  }
  ///

  let tradeObject = {
      "gas_fee_usd": originalData.gasCostUSD,
      "gas_fee_eth": originalData.gasValue,
      "transaction_address": originalData.transaction.hash,
      "timestamp": originalData.block.timestamp.unixtime,
      "block": originalData.block.height,
      "tokens_in": [],
      "tokens_out": []
  };

  originalData.transfers.forEach(transfer => {
      // Check if it's ether based on symbol or address and assign the known address if needed
      let isEther = transfer.currency.symbol === "ETH" && transfer.currency.address === "-";
      let tokenAddress = isEther ? wrappedEther : transfer.currency.address;
																													 
																													   
		  

      let tokenTransferObject = {
          "address": tokenAddress,
          "symbol": transfer.currency.symbol,
          "decimals": transfer.currency.decimals,
          "amount": transfer.amount,
          "amount_in": transfer.sender.address.toLowerCase() === userAddress.toLowerCase() ? transfer.amount : "0",
															
          "amount_out": transfer.receiver.address.toLowerCase() === userAddress.toLowerCase() ? transfer.amount : "0",
          "price_usd": 0
      };
	   
						  
																				

      // Push to tokens_in or tokens_out based on the user being the sender or receiver
      if (transfer.sender.address.toLowerCase() === userAddress.toLowerCase()) {
          tradeObject.tokens_in.push(tokenTransferObject);
      } else if (transfer.receiver.address.toLowerCase() === userAddress.toLowerCase()) {
          tradeObject.tokens_out.push(tokenTransferObject);
      }
  });
  // Summarize tokens in
  tradeObject.tokens_in = summarizeTokens(tradeObject.tokens_in, 'amount_in');

  // Summarize tokens out
  tradeObject.tokens_out = summarizeTokens(tradeObject.tokens_out, 'amount_out');

  // Handle the case of 'change' being returned
  handleTokenChange(tradeObject.tokens_in, tradeObject.tokens_out);

  if (!isValidTrade(tradeObject)) {
      return false; 
  }
  tradeObject.direction = determineTradeDirection(tradeObject);

  return tradeObject;
}

  module.exports =  {transformData, createTradeObject};