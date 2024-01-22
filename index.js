require('dotenv').config();
const { Telegraf } = require('telegraf');
const { startCmd } = require('./cmds/startCmd');
const { addressesCmd, documentAddressesCmd } = require('./cmds/addressesCmd');
const {buyersCmd} = require('./cmds/buyersCmd');


const bot = new Telegraf(process.env.TELEGRAM_API_KEY, {handlerTimeout: 900_000}); // 10min

bot.start(startCmd);
bot.command('addresses', addressesCmd);
bot.command('buyers', buyersCmd);

bot.on('document', (ctx)=>documentAddressesCmd(ctx))

bot.launch();
