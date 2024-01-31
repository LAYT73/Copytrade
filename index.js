require('dotenv').config();
const { Telegraf } = require('telegraf');
const { startCmd } = require('./cmds/startCmd');
const { addressesCmd, documentAddressesCmd } = require('./cmds/addressesCmd');
const {buyersCmd} = require('./cmds/buyersCmd');

const moment = require("moment");


// Log the arguments
const args = process.argv.slice(2);
console.log('Command-line arguments:', args);

// check migrations
if (args[0] === '--migration') {
  // check migration params
  let migration = require('./services/databaseMigrationService');
  migration.migrate();
  return;
}

// check bitquery
if (args[0] === '--bitquery') {
  let bitqueryService = require('./services/bitqueryService');
  bitqueryService.getTokenPrices('0xcddb5825e15eae462719ac68d200f9f09eb9d1d7', moment(new Date()).subtract(10, 'month'), new Date());
  return;
}

// schedulers
let schedule = require('./services/scheduleService');
schedule.init();

const bot = new Telegraf(process.env.TELEGRAM_API_KEY, {handlerTimeout: 900_000}); // 10min
bot.start(startCmd);
bot.command('addresses', addressesCmd);
bot.command('buyers', buyersCmd);

bot.on('document', (ctx)=>documentAddressesCmd(ctx))

bot.launch();
