require('dotenv').config(); 
const { Telegraf } = require('telegraf');
const { startCmd } = require('./cmds/startCmd');
const { addressesCmd, documentAddressesCmd } = require('./cmds/addressesCmd');


const bot = new Telegraf(process.env.TELEGRAM_API_KEY);

//test
bot.start(startCmd);
bot.command('addresses', addressesCmd);
bot.on('document', (ctx)=>documentAddressesCmd(ctx))

bot.launch();
