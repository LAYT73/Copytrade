require('dotenv').config(); 
const path = require('path');
const fs = require('fs');
const needle = require('needle');
const { prefetchDataLengthFromBitQuery, fetchDataInParallel } = require('../svcs/bitQuerySvc');
const { transfersByAdressesCount, transfersByAdresses} = require('../utils/queries');
const { parseAndValidateInput } = require('../utils/inputParserUtils'); // Example name for input parsing utility
const tradeService = require('../svcs/tradeService');
const excelService = require('../svcs/excelService');
const {    createTradeObject} = require('../svcs/reportGenSvc');
const {    transformData } = require('../svcs/reportGenSvc');
const {assignPricesToTrades} = require('../svcs/priceGatheringSvc');

function batchAddressesWithParameters(addresses, startDate, endDate, batchSize = 100) {
    const totalBatches = Math.ceil(addresses.length / batchSize);
    const parametersBatches = [];

    for (let i = 0; i < totalBatches; i++) {
        const batchStartIndex = i * batchSize;
        const batchEndIndex = batchStartIndex + batchSize;
        const currentBatch = addresses.slice(batchStartIndex, batchEndIndex);

        const batchObject = {
            parameters: {
                limit: 25000, // You can adjust this value
                offset: 0,
                network: "ethereum",
                addresses: currentBatch,
                from: startDate,
                till: endDate
            },
            count: -1
        };

        parametersBatches.push(batchObject);
    }

    return parametersBatches;
}

async function documentAddressesCmd(ctx) {
    const inputText = ctx.message?.caption;
    const command = inputText?.split(' ')[0]; 
    if (command === '/addresses') {
        try {
            if (ctx.message.document) {
                const fileId = ctx.message.document.file_id;
                const file = await ctx.telegram.getFile(fileId);
                needle.get(`https://api.telegram.org/file/bot${process.env.TELEGRAM_API_KEY}/${file.file_path}`, async function(error, response) {
                    if (!error && response.statusCode == 200) {
                        const fileContentBuffer = response.body;
                        const fileContentString = fileContentBuffer.toString('utf-8');
                        ctx.message.text = fileContentString;
                        addressesCmd(ctx);
                    }
                });
            } else {
                ctx.reply('No file attached. Please attach a text file (txt).');
            }
        } catch (error) {
            console.error(error);
            ctx.reply('An error occurred while processing the file. ' + error.message);
        }
    }
}
async function addressesCmd(ctx) {
	const messageTimestamp = ctx.message.date * 1000; 
    const currentTimestamp = new Date().getTime();
    const timeDifferenceMinutes = (currentTimestamp - messageTimestamp) / (1000 * 60);
    if (timeDifferenceMinutes >= 1) {
		ctx.reply("Sorry, this command can only be used for messages received within the last 10 minutes.");
        return
	}
    const inputText = ctx.message.text;	
    try {
        const {
            addressesFull,
            startDate,
            endDate
        } = parseAndValidateInput(inputText);
        console.log('Parsed Input:', {
            addressesFull,
            startDate,
            endDate
        });
        // Batch the addresses into chunks of 500
        const chunkSize = 500;
        const addressChunks = [];
        for (let i = 0; i < addressesFull.length; i += chunkSize) {
            const chunk = addressesFull.slice(i, i + chunkSize);
            addressChunks.push(chunk);
        }
        console.log(addressChunks);
        for (const addresses of addressChunks) {
            console.log(addresses);
            // Batch the addresses and prepare the parameters
            const batchedAddressObjects = batchAddressesWithParameters(addresses, startDate, endDate);
            console.log('Batched Address Objects:', batchedAddressObjects);
            // Fetch the data count for each batch
            for (let batch of batchedAddressObjects) {
                try {
                    const count = await prefetchDataLengthFromBitQuery(transfersByAdressesCount, batch.parameters);
                    batch.count = count;
                } catch (error) {
                    console.error('Error fetching data count for batch:', {
                        batch
                    }, error.message);
                }
            }
            const allDataResults = [];
            for (let batch of batchedAddressObjects) {
                try {
                    const fetchDataResults = await fetchDataInParallel(transfersByAdresses, batch.parameters, batch.count);
                    for (const result of fetchDataResults) {
                        if (result.data && result.data.ethereum && result.data.ethereum.transfers) {
                            allDataResults.push(...result.data.ethereum.transfers);
                        }
                    }
                    console.log(new Date() + ' Data Fetched for Batch Count:', batch.count);
                } catch (error) {
                    console.error('Error fetching data for batch:', {
                        batch
                    }, error.message);
                }
            }
        
                // const fetchDataPromises = batchedAddressObjects.map(batch => 
                //     fetchDataInParallel(transfersByAdresses, batch.parameters, batch.count)
                //       .then(fetchDataResults => {
                //         fetchDataResults.forEach(result => {
                //           if (result.data && result.data.ethereum && result.data.ethereum.transfers) {
                //             allDataResults.push(...result.data.ethereum.transfers);
                //           }
                //         });
                //         console.log(new Date() + ' Data Fetched for Batch Count:', batch.count);
                //       })
                //       .catch(error => {
                //         console.error('Error fetching data for batch:', {
                //           batch
                //         }, error.message);
                //       })
                //   );
                //   await Promise.all(fetchDataPromises);
        
                const filePath = path.join(__dirname, 'dataResults.json');
                // fs.writeFileSync(filePath, JSON.stringify(allDataResults, null, 4));
                console.log('Data saved to:', filePath);
        
                const transformedData = transformData(allDataResults);
                // Process each user's transactions
        Object.entries(transformedData).forEach(([userAddress, transactions]) => {
            console.log(`Processing trades for user: ${userAddress}`);
            transformedData[userAddress] = transactions.map(transaction => createTradeObject(userAddress, transaction)).filter(trade => trade !== false);
        });
            await assignPricesToTrades(transformedData, allDataResults);
            // Optionally, write the results to a file
            //   fs.writeFileSync('processedTrades.json', JSON.stringify(transformedData, null, 2));

            console.log(`Finished processing trades.`);
            for (const [address, trades] of Object.entries(transformedData)) {
                if (trades.length === 0) {
                    delete transformedData[address];
                }
            }
            async function analyzeAndSummarizeData(transformedData) {
                let structuredSummaryData = {};
            
                for (const [address, trades] of Object.entries(transformedData)) {
                    const analysis = tradeService.analyzeTrades(trades);
                    const reportList = await tradeService.generateReportList(analysis.positionHistory);
                    const summaryData = tradeService.formReportSummary(trades, reportList, address);
                    structuredSummaryData[address] = {
                        trades: trades,
                        positionHistory: analysis.positionHistory,
                        reportList: reportList,
                        summaryData: summaryData
                    };
                }
                return structuredSummaryData;
            }
            const result = await analyzeAndSummarizeData(transformedData);
            console.log(`Finished analyzing and summarizing trades.`);
            console.log(`Generating Excel report...`);
            filename = await excelService.generateExcel(result);
                console.log(filename);
                await ctx.replyWithDocument({
                    source: filename
                })
            ////////////////////////
        }
        console.log(`Finished processing all batches.`);
    
        } catch (error) {
            console.error(error);
            ctx.reply('An error occurred while generating the report. ' + error.message);
        }
        
    }


module.exports = { addressesCmd, documentAddressesCmd };
