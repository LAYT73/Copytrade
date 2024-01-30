require('dotenv').config();
const { Telegraf } = require('telegraf');
const { startCmd } = require('./cmds/startCmd');
const { addressesCmd, documentAddressesCmd } = require('./cmds/addressesCmd');
const {buyersCmd} = require('./cmds/buyersCmd');

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

// schedulers
let schedule = require('./services/scheduleService');
schedule.init();

const bot = new Telegraf(process.env.TELEGRAM_API_KEY, {handlerTimeout: 900_000}); // 10min
bot.start(startCmd);
bot.command('addresses', addressesCmd);
bot.command('buyers', buyersCmd);

bot.on('document', (ctx)=>documentAddressesCmd(ctx))

bot.launch();
