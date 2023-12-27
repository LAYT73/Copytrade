const ExcelJS = require('exceljs');

function expandSciNotation(str) {
    let [base, exponent] = str.split('e');
    if (!exponent) return str; // Not in scientific notation.
    let [intPart, decimalPart] = base.split('.');
    decimalPart = decimalPart || '';

    let exponentValue = parseInt(exponent);
    if (exponentValue > 0) {
        // For positive exponent, shift the decimal point to the right.
        return intPart + decimalPart.padEnd(exponentValue, '0');
    } else {
        // For negative exponent, shift the decimal point to the left.
        let totalDigits = intPart.length + decimalPart.length;
        let shift = Math.abs(exponentValue);

        if (shift < intPart.length) {
            // If shift is within the integer part
            return intPart.slice(0, -shift) + '.' + intPart.slice(-shift) + decimalPart;
        } else {
            // If shift moves into or beyond the decimal part
            let zerosNeeded = shift - intPart.length;
            let leadingZeros = '0'.repeat(Math.max(zerosNeeded, 0));
            return '0.' + leadingZeros + intPart + decimalPart;
        }
    }
}


function roundNicely(s) {
    if (["null", "NaN", "infinity", "Infinity"].includes(s.toLowerCase())) {
        return s;  // Keep these values as strings.
    }

    let fullNumberString = s.includes('e') ? expandSciNotation(s) : s;

    if (fullNumberString.indexOf('.') === -1) {
        return parseFloat(fullNumberString);  // Convert to a number.
    }

    let postDecimal = fullNumberString.split('.')[1];

    if (postDecimal[0] !== '0') {
        return postDecimal.length <= 5 ? parseFloat(fullNumberString) : parseFloat(parseFloat(fullNumberString).toFixed(5));
    }

    for (let i = 0; i < postDecimal.length; i++) {
        if (postDecimal[i] !== '0') {
            return postDecimal.length - i > 5 ? parseFloat(parseFloat(fullNumberString).toFixed(i + 5)) : parseFloat(fullNumberString);
        }
    }

    return parseFloat(fullNumberString);  // Convert to a number.
}



exports.generateExcel = async (structuredSummaryData) => {
    const workbook = new ExcelJS.Workbook();
    const summaryWorksheet = workbook.addWorksheet('Summaries');
	const reportListWorksheet = workbook.addWorksheet('Report');
	const tradesWorksheet = workbook.addWorksheet('Trades');
	
summaryWorksheet.columns = [
 { header: 'Wallet', key: 'wallet' },
 { header: 'Total Trades', key: 'totalTrades' },
 { header: 'Total Tokens', key: 'totalTokens' },
 { header: 'Winrate Realized %', key: 'winrateRealizedPercentage' }, 
 { header: 'Num Realized Trades', key: 'numRealizedTrades' },
 { header: 'Winrate Unrealized%', key: 'winrateUnrealizedPercentage' }, 
 { header: 'Num Unrealized Trades', key: 'numUnrealizedTrades' }, 
 { header: 'PnL R', key: 'PnL_R' },
 { header: 'PnL R%', key: 'PnL_R_Percentage' },
 { header: 'Average Realized%', key: 'averageRealizedPercentage' },
 { header: 'PnL U', key: 'PnL_U' },
 { header: 'PnL U%', key: 'PnL_U_Percentage' },
 { header: 'Average Unrealized%', key: 'averageUnrealizedPercentage' },
 { header: 'Buys', key: 'buys' },
 { header: 'Sells', key: 'sells' },
 { header: 'Converts', key: 'converts' },
 { header: 'Total Fees', key: 'totalFees' },
 { header: 'First Trade', key: 'firstTrade' },
 { header: 'Last Trade', key: 'lastTrade' }
];

reportListWorksheet.columns = [
    { header: 'Wallet', key: 'wallet' },
  { header: "Symbol", key: "symbol", width: 10 },
  { header: "Address", key: "address", width: 32 },
  { header: "Total Bought", key: "totalBought", width: 15 },
  { header: "Total Sold", key: "totalSold", width: 15 },
  { header: "Total Fees", key: "totalFees", width: 15 },
  { header: "Delta", key: "delta", width: 15 },
  { header: "Delta USD", key: "deltaUsd", width: 15 },
  { header: "Bought Sum USD", key: "boughtSumUsd", width: 15 },
  { header: "Sold Sum USD", key: "soldSumUsd", width: 15 },
  { header: "Delta PNL USD", key: "deltaPnlUsd", width: 15 },
  { header: "Delta PNL Percentage", key: "deltaPnlPercentage", width: 20 },
  { header: "Number of Buys", key: "numBuys", width: 15 },
  { header: "Number of Sells", key: "numSells", width: 15 },
  { header: "Last Tx Date", key: "lastTxDate", width: 20 },
  { header: "Liquidity USD", key: "liquidityUsd", width: 15 },
  { header: "Day Volume USD", key: "dayVolumeUsd", width: 15 }
];

tradesWorksheet.columns = [
    { header: 'Wallet', key: 'wallet' },
    { header: 'Direction', key: 'direction' },
    { header: 'Transaction Address', key: 'transaction_address' },
    { header: 'Timestamp', key: 'timestamp' },
    { header: 'Block Number', key: 'block_number' },
    { header: 'Wallet Address', key: 'wallet_address' },
    { header: 'Gas Fee USD', key: 'gas_fee_usd' },
    { header: 'Token In Address', key: 'token_in_address' },
    { header: 'Token In Symbol', key: 'token_in_symbol' },
    { header: 'Token In Amount', key: 'token_in_amount' },
    { header: 'Token Out Address', key: 'token_out_address' },
    { header: 'Token Out Symbol', key: 'token_out_symbol' },
    { header: 'Token Out Amount', key: 'token_out_amount' },
  ];

let countEntries = 0;

Object.entries(structuredSummaryData).forEach(([address, data]) => {
  const wallet = address;
  const { summaryData, reportList, trades } = data;

  // Now you can use summaryData, reportList, and trades as variables here for the current address
  // Example operation:
  // console.log(wallet, summaryData, reportList, trades);
  debugger;
  summaryWorksheet.addRow({
    wallet: wallet,
    firstTrade: summaryData.firstTrade,
    lastTrade: summaryData.lastTrade,
    totalTrades: summaryData.totalTrades,
    totalTokens: summaryData.totalTokens,
    buys: summaryData.buys,
    sells: summaryData.sells,
    converts: summaryData.converts,
    totalFees: summaryData.totalFees,
    PnL_R: summaryData.PnL_R,
    PnL_R_Percentage: summaryData.PnL_R_Percentage,
    averageRealizedPercentage: summaryData.averageRealizedPercentage,
    PnL_U: summaryData.PnL_U,
    PnL_U_Percentage: summaryData.PnL_U_Percentage,
    averageUnrealizedPercentage: summaryData.averageUnrealizedPercentage,
    winrateRealizedPercentage: summaryData.winrateRealizedPercentage,
    winrateUnrealizedPercentage: summaryData.winrateUnrealizedPercentage,
    numRealizedTrades: summaryData.numRealizedTrades,
    numUnrealizedTrades: summaryData.numUnrealizedTrades
  });
  
    // Add the data from the report list
reportList.forEach((entry) => {
    reportListWorksheet.addRow({        
        wallet: wallet,
        symbol: entry.symbol,
        address: entry.address,
        totalBought: roundNicely(entry.totalBought.toString()),
        totalSold: roundNicely(entry.totalSold.toString()),
        totalFees: roundNicely(entry.totalFees.toString()),
        delta: roundNicely(entry.delta.toString()),
        deltaUsd: roundNicely(entry.deltaUsd.toString()),
        boughtSumUsd: roundNicely(entry.boughtSumUsd.toString()),
        soldSumUsd: roundNicely(entry.soldSumUsd.toString()),
        deltaPNLUsd: roundNicely(entry.deltaPNLUsd.toString()),
        deltaPNLPercentage: roundNicely(entry.deltaPNLPercentage.toString()),
        numberOfBuys: roundNicely(entry.numberOfBuys.toString()),
        numberOfSells: roundNicely(entry.numberOfSells.toString()),
        lastTxDate: entry.lastTxDate,
        liquidityUsd: roundNicely(entry.liquidityUsd.toString()),
        dayVolumeUsd: roundNicely(entry.dayVolumeUsd.toString())
    });
});

  // Trades worksheet    
  trades.forEach((trade) => {
    const row = {        
        wallet: wallet,
      chain_id: trade.chain_id,
      direction: trade.direction,
      transaction_address: trade.transaction_address,
      timestamp: trade.timestamp,
      block_number: trade.blockNumber,      
      gas_fee_usd: trade.gas_fee_usd,
      token_in_address: trade.tokens_in[0].address,
      token_in_symbol: trade.tokens_in[0].symbol,
      token_in_amount: trade.tokens_in[0].amount_in,
      token_out_address: trade.tokens_out[0].address,
      token_out_symbol: trade.tokens_out[0].symbol,
      token_out_amount: trade.tokens_out[0].amount_out,
    };

    tradesWorksheet.addRow(row);
  });
  

  countEntries++;
});


// Set the views to freeze after the header
    summaryWorksheet.views = [
        {
            state: 'frozen',
            xSplit: 0,
            ySplit: 1 // Freezing after the third row (which is our header row)
        }
    ];
	// Set the views to freeze after the header
    reportListWorksheet.views = [
        {
            state: 'frozen',
            xSplit: 0,
            ySplit: 1 // Freezing after the third row (which is our header row)
        }
    ];
	// Set the views to freeze after the header
    tradesWorksheet.views = [
        {
            state: 'frozen',
            xSplit: 0,
            ySplit: 1 // Freezing after the third row (which is our header row)
        }
    ];
  

  // Format the date and file name
  const date = new Date();
  const formattedDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}-${date.getMilliseconds()}`;
    const filename = `./excel_dump/${formattedDate}_${countEntries}_wallets.xlsx`;

  await workbook.xlsx.writeFile(filename);
  return filename;
};
