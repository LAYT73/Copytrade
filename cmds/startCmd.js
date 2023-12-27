function startCmd(ctx) {
    const greetingMessage = `
Hello there! Welcome to the bot. 🤖

You can use the following commands:

1. 🔗 '/addresses': This command allows you to get information for multiple Ethereum addresses. 
   Format: 
   /addresses 0xAddress1 0xAddress2 ... 0xAddressN numberOfDays
   Example:
   /addresses 0x123... 0x456... 30

2. 🛍 '/buyers': This command gives you buyer information for a specific token.
   Format:
   /buyers 0xTokenAddress numberOfDays
   Example:
   /buyers 0x789... 30

Note:
- 🛠 The '/tokens' command is still in development and will be available soon!

Remember to replace the placeholders with your actual Ethereum addresses or token addresses. 

Have fun exploring!
`;

ctx.reply(greetingMessage);

}

// Register this in your bot command
// bot.command('start', startCmd);
module.exports = { startCmd }