const axios = require('axios');
const BigNumber = require('bignumber.js');
const {fetchTokenPricesInBatches} = require('../svcs/priceGatheringSvc')
// Declare your stablecoin addresses and wrapped ether address

const wrappedEther = ['0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'];



function analyzeTrades(trades) {
  let positions = [];
  let totalProfit = 0;
  let totalCost = 0;
  let totalVolume = 0;
  let positionHistory = [];

  const handlePositionEvent = (positionHistory, event, transaction_address, timestamp, token, props) => {
    positionHistory.push({
      event: event,
      transaction_link: `https://etherscan.io/tx/${transaction_address}`,
      date_time: timestamp,
      token: token.symbol,
	  tokenAddress: token.address,
      ...props
    });
  };

  const openPosition = (positions, trade) => {
    trade.tokens_out.forEach((token_out) => {
      const existingPosition = positions.find(pos => pos.address === token_out.address);
      const baseToken = trade.tokens_in[0];  // We assume there's only one token in `tokens_in`
        const tradedAmount = new BigNumber(baseToken.amount_in).minus(baseToken.amount_out).toString();
        const totalCost = new BigNumber(tradedAmount)
            .times(new BigNumber(baseToken.price_usd))
            .plus(new BigNumber(trade.gas_fee_usd))
            .toString();

      if (existingPosition) {
        const newTotalCost = new BigNumber(existingPosition.price_usd)
                .times(new BigNumber(existingPosition.quantity))
                .plus(new BigNumber(totalCost))
                .toString();
        existingPosition.quantity = new BigNumber(existingPosition.quantity)
                .plus(new BigNumber(token_out.amount_out))
                .toString();
        existingPosition.price_usd = new BigNumber(newTotalCost)
                .dividedBy(new BigNumber(existingPosition.quantity))
                .toString();

        // handle position event
        handlePositionEvent(positionHistory, "increase position", trade.transaction_address, trade.timestamp, token_out, {
          quantity: token_out.amount_out,
          price_usd: existingPosition.price_usd,
		  gas_fee_usd: trade.gas_fee_usd
        });

      } else {
        const newPosition = {
          transaction_address: trade.transaction_address,
          timestamp: trade.timestamp,
          blockNumber: trade.blockNumber,
          address: token_out.address,
          symbol: token_out.symbol,
          quantity: token_out.amount_out,
          price_usd: new BigNumber(totalCost).dividedBy(new BigNumber(token_out.amount_out)).toString()
        };

        positions.push(newPosition);

        // handle position event
        handlePositionEvent(positionHistory, "new position", trade.transaction_address, trade.timestamp, token_out, {
          quantity: newPosition.quantity,
          price_usd: newPosition.price_usd,
		  gas_fee_usd: trade.gas_fee_usd
        });
      }
    });
  };

  const closePosition = (positions, trade) => {
    const token_in = trade.tokens_in[0];
    const token_out = trade.tokens_out[0];
    const existingPosition = positions.find(pos => pos.address === token_in.address);

    if (!existingPosition) {
        console.warn(`Attempting to close a non-existent position for ${token_in.symbol}. Ignoring this operation.`);
        return { profit: '0', cost: '0' };
    }
    
    if (new BigNumber(existingPosition.quantity).isLessThan(new BigNumber(token_in.amount_in))) {
        console.warn(`Attempting to sell more than available for ${token_in.symbol}. Only selling the available amount.`);
        
        const adjustmentRatio = new BigNumber(existingPosition.quantity).dividedBy(token_in.amount_in);

        token_in.amount_in = existingPosition.quantity;
        token_out.amount_out = new BigNumber(token_out.amount_out).times(adjustmentRatio).toString();
    }

    const cost = new BigNumber(token_in.amount_in)
        .times(new BigNumber(existingPosition.price_usd))
        .toString();

    const revenue = new BigNumber(token_out.amount_out)
        .times(new BigNumber(token_out.price_usd))
        .minus(new BigNumber(trade.gas_fee_usd))
        .toString();

    const profit = new BigNumber(revenue)
        .minus(new BigNumber(cost))
        .toString();

    existingPosition.quantity = new BigNumber(existingPosition.quantity)
        .minus(new BigNumber(token_in.amount_in))
        .toString();

    // Avoiding division by zero or a very small number
    const price_usd = (new BigNumber(token_in.amount_in).isGreaterThan(0)) 
        ? new BigNumber(revenue).dividedBy(new BigNumber(token_in.amount_in)).toString() 
        : '0';

    handlePositionEvent(positionHistory, "sell", trade.transaction_address, trade.timestamp, token_in, {
        quantity: token_in.amount_in,
        price_usd: price_usd,
        gas_fee_usd: trade.gas_fee_usd,
        profit: profit 
    });

    return { profit: profit, cost: cost };
};



  trades.forEach((trade) => {
    if (trade.direction === 'buy') {
      trade.tokens_out.forEach(() => {
        openPosition(positions, trade);
      });
    } else if (trade.direction === 'sell') {
      const results = closePosition(positions, trade);
      totalProfit += results.profit;
	  totalCost += results.cost;
    } else if (trade.direction === 'convert') {
      trade.tokens_out.forEach(() => {
        openPosition(positions, trade);
      });
      trade.tokens_in.forEach(() => {
        const results = closePosition(positions, trade);
        totalProfit += results.profit;
		totalCost += results.cost;
      });
    }
  });  

  return {
    totalProfit,	    
    positions,
    positionHistory
  };
}

async function generateReportList(positionHistory) {
    const reportList = [];

    // Group positions by tokenAddress
    const groupedPositions = positionHistory.reduce((acc, position) => {
        const { tokenAddress } = position;
        if (!acc[tokenAddress]) {
            acc[tokenAddress] = [];
        }
        acc[tokenAddress].push(position);
        return acc;
    }, {});

    const tokenAddresses = Object.keys(groupedPositions); 

    try {
        const { prices, volumes, liquidities } = await fetchTokenPricesInBatches(tokenAddresses);


        for (const tokenAddress in groupedPositions) {
            const positions = groupedPositions[tokenAddress];
            const tokenInfo = positions[0];

            // Initialize report item
                    const reportItem = {
            symbol: tokenInfo.token,
            address: tokenAddress,
            totalBought: new BigNumber(0),
            totalSold: new BigNumber(0),
            avgAcqPrice: new BigNumber(0),
            boughtSumUsd: new BigNumber(0),
            soldSumUsd: new BigNumber(0),
            totalFees: new BigNumber(0),
            delta: new BigNumber(0),
            deltaUsd: new BigNumber(0),
            deltaPNLUsd: new BigNumber(0),
            deltaPNLPercentage: new BigNumber(0),
            numberOfBuys: 0,
            numberOfSells: 0,
            lastTxDate: null,
            liquidityUsd: new BigNumber(liquidities[tokenAddress] || 0),
            dayVolumeUsd: new BigNumber(volumes[tokenAddress] || 0),
            PNL_R: new BigNumber(0),
            PNL_R_P: new BigNumber(0),
            PNL_UR: new BigNumber(0),
            PNL_UR_P: new BigNumber(0),
            PNL_R_boughtSumUsd: new BigNumber(0),
            PNL_UR_boughtSumUsd: new BigNumber(0)
        };

        positions.forEach(position => {
            const quantityBN = new BigNumber(position.quantity);
            const priceUsdBN = new BigNumber(position.price_usd);

            if (position.event === "new position" || position.event === "increase position") {
                reportItem.totalBought = reportItem.totalBought.plus(quantityBN);
                reportItem.boughtSumUsd = reportItem.boughtSumUsd.plus(quantityBN.times(priceUsdBN));
                reportItem.numberOfBuys += 1;
            } else if (position.event === "sell") {
                reportItem.totalSold = reportItem.totalSold.plus(quantityBN);
                reportItem.soldSumUsd = reportItem.soldSumUsd.plus(quantityBN.times(priceUsdBN));
                reportItem.totalFees = reportItem.totalFees.plus(new BigNumber(position.gas_fee_usd));
                reportItem.PNL_R = reportItem.PNL_R.plus(new BigNumber(position.profit));
                reportItem.numberOfSells += 1;
            }

            if (!reportItem.lastTxDate || position.date_time > reportItem.lastTxDate) {
                reportItem.lastTxDate = position.date_time;
            }
        });

        reportItem.avgAcqPrice = reportItem.boughtSumUsd.dividedBy(reportItem.totalBought);
        reportItem.PNL_R_boughtSumUsd = reportItem.totalSold.times(reportItem.avgAcqPrice);
        reportItem.PNL_UR_boughtSumUsd = reportItem.totalBought.minus(reportItem.totalSold).times(reportItem.avgAcqPrice);

        reportItem.delta = reportItem.totalBought.minus(reportItem.totalSold);
        // reportItem.deltaUsd = reportItem.delta.times(prices[tokenAddress] || 0);
        // debugger;
        const usdLiquidity = new BigNumber(liquidities[tokenAddress] || 1);
        const tokenPrice = new BigNumber(prices[tokenAddress] || 0.0000000001);
        const tokenLiquidity = usdLiquidity.div(tokenPrice);
        const amountIn = new BigNumber(reportItem.delta);
        
        if (amountIn.isZero() || tokenLiquidity.isZero()) {
            reportItem.deltaUsd = new BigNumber(0);
        } else {
            try {
                let numerator = amountIn.times(usdLiquidity);
                let denominator = tokenLiquidity.plus(amountIn);
                let amountOut = numerator.div(denominator);
        
                reportItem.deltaUsd = amountOut;
            } catch (error) {
                reportItem.deltaUsd = new BigNumber(0);
            }
        }
        
        
              

        reportItem.deltaPNLUsd = reportItem.deltaUsd.plus(reportItem.soldSumUsd).minus(reportItem.boughtSumUsd);
        reportItem.deltaPNLPercentage = reportItem.boughtSumUsd.isEqualTo(0) ? new BigNumber(0) : reportItem.deltaPNLUsd.dividedBy(reportItem.boughtSumUsd).times(100);

        reportItem.PNL_R_P = reportItem.PNL_R_boughtSumUsd.isEqualTo(0) ? new BigNumber(0) : reportItem.PNL_R.dividedBy(reportItem.PNL_R_boughtSumUsd).times(100);
        reportItem.PNL_UR = reportItem.deltaUsd.minus(reportItem.PNL_UR_boughtSumUsd);

        reportItem.PNL_UR_P = reportItem.PNL_UR_boughtSumUsd.isEqualTo(0) ? new BigNumber(0) : reportItem.PNL_UR.dividedBy(reportItem.PNL_UR_boughtSumUsd).times(100);

        reportList.push(reportItem);
    }

    return reportList;

    } catch (error) {
        console.error('Error fetching token prices:', error);
        return reportList;
    }
}

function formReportSummary(trades, reportList, address) {
    function formatDate(timestamp) {
        const date = new Date(timestamp * 1000); // Convert to milliseconds
        return `${date.getDate()}.${date.getMonth()+1}.${date.getFullYear()} / ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    }
	
// Helper function to check if a string can be converted to a valid number
function isValidNumber(str) {
    try {
        new BigNumber(str);
        return true;
    } catch (err) {
        return false;
    }
}

    
// Filter uList
const uList = [...reportList].filter(item => {
    return (
        isValidNumber(item.totalBought) &&
        isValidNumber(item.totalSold) &&
        isValidNumber(item.delta) &&
        isValidNumber(item.deltaUsd) &&
        isValidNumber(item.PNL_UR) &&
        isValidNumber(item.PNL_UR_P) &&
        new BigNumber(item.totalSold).dividedBy(item.totalBought).isLessThanOrEqualTo(0.98)
    );
});

// Filter rList
const rList = [...reportList].filter(item => {
    return (
        isValidNumber(item.totalBought) &&
        isValidNumber(item.totalSold) &&
        isValidNumber(item.boughtSumUsd) &&
        isValidNumber(item.soldSumUsd) &&
        isValidNumber(item.PNL_R) &&
        isValidNumber(item.PNL_R_P)
    );
});

    // Continue with the rest of the logic using the two lists: rList and uList

    // Sort trades by timestamp in ascending order
    trades.sort((a, b) => a.timestamp - b.timestamp);

    // Initialize counters using BigNumber
    let totalBuys = new BigNumber(0);
    let totalSells = new BigNumber(0);
    let totalConverts = new BigNumber(0);
    let totalFeesUSD = new BigNumber(0);

    trades.forEach(trade => {
        if (trade.direction === "buy") totalBuys = totalBuys.plus(1);
        else if (trade.direction === "sell") totalSells = totalSells.plus(1);
        else if (trade.direction === "convert") totalConverts = totalConverts.plus(1);
        totalFeesUSD = totalFeesUSD.plus(trade.gas_fee_usd);
    });

    // Calculate PnL and other metrics using rList and uList
    let totalRealizedUSD = new BigNumber(0);
    let totalUnrealizedUSD = new BigNumber(0);
    let PNL_R_boughtSumUsd = new BigNumber(0);
    let PNL_UR_boughtSumUsd = new BigNumber(0);
    let profitableRealizedTrades = 0;
    let unprofitableRealizedTrades = 0;
    let profitableUnrealizedTrades = 0;
    let unprofitableUnrealizedTrades = 0;

    rList.forEach(item => {
        const PNL_R = new BigNumber(item.PNL_R);
        totalRealizedUSD = totalRealizedUSD.plus(PNL_R);
        PNL_R_boughtSumUsd = PNL_R_boughtSumUsd.plus(item.PNL_R_boughtSumUsd);
        
        if (PNL_R.isGreaterThan(0)) profitableRealizedTrades++;
        else if (PNL_R.isLessThan(0)) unprofitableRealizedTrades++;
    });

    uList.forEach(item => {
        const PNL_UR = new BigNumber(item.PNL_UR);
        totalUnrealizedUSD = totalUnrealizedUSD.plus(PNL_UR);
        PNL_UR_boughtSumUsd = PNL_UR_boughtSumUsd.plus(item.PNL_UR_boughtSumUsd);
        
        if (PNL_UR.isGreaterThan(0)) profitableUnrealizedTrades++;
        else if (PNL_UR.isLessThan(0)) unprofitableUnrealizedTrades++;
    });
	
	// Compute the average PnL percentage for realized
const averageRealizedPNLPercentage = rList
    .map(item => new BigNumber(item.PNL_R_P))
    .reduce((acc, value) => acc.plus(value), new BigNumber(0))
    .dividedBy(rList.length)
    .toFixed(2);

// Compute the average PnL percentage for unrealized
const averageUnrealizedPNLPercentage = uList
    .map(item => new BigNumber(item.PNL_UR_P))
    .reduce((acc, value) => acc.plus(value), new BigNumber(0))
    .dividedBy(uList.length)
    .toFixed(2);


    // Create the summaryData object with calculated values
const summaryData = {
    firstTrade: formatDate(trades[0].timestamp),
    lastTrade: formatDate(trades[trades.length - 1].timestamp),
    totalTrades: trades.length,
    totalTokens: new Set(reportList.map(item => item.symbol)).size, 
    buys: totalBuys.toNumber(),
    sells: totalSells.toNumber(),
    converts: totalConverts.toNumber(),
    totalFees: parseFloat(totalFeesUSD.toFixed(2)),
    PnL_R: parseFloat(totalRealizedUSD.toFixed(2)),
    PnL_R_Percentage: parseFloat(totalRealizedUSD.dividedBy(PNL_R_boughtSumUsd).multipliedBy(100).toFixed(2)),
    averageRealizedPercentage: parseFloat(averageRealizedPNLPercentage),
    PnL_U: parseFloat(totalUnrealizedUSD.toFixed(2)),
    PnL_U_Percentage: parseFloat(totalUnrealizedUSD.dividedBy(PNL_UR_boughtSumUsd).multipliedBy(100).toFixed(2)),
    averageUnrealizedPercentage: parseFloat(averageUnrealizedPNLPercentage),
    winrateRealizedPercentage: parseFloat((profitableRealizedTrades / (profitableRealizedTrades + unprofitableRealizedTrades) * 100).toFixed(2)),
    winrateUnrealizedPercentage: parseFloat((profitableUnrealizedTrades / (profitableUnrealizedTrades + unprofitableUnrealizedTrades) * 100).toFixed(2)),
    numRealizedTrades: profitableRealizedTrades + unprofitableRealizedTrades,
    numUnrealizedTrades: profitableUnrealizedTrades + unprofitableUnrealizedTrades
};

    return summaryData;
}

module.exports = {  
  analyzeTrades,
  generateReportList,
  formReportSummary
};
