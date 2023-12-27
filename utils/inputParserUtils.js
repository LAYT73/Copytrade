const moment = require('moment');  // assuming you have moment.js for date calculations

function parseAndValidateInput(inputString) {
    try {
        // Split by space or newline
        const splitStrings = inputString.trim().split(/[\s\n]+/);

        // Check if the last element is a valid number for days
        const days = parseInt(splitStrings[splitStrings.length - 1]);
        if (isNaN(days)) {
            // ctx.reply('Invalid number of days.');
        }

        // Remove the days from the array
        splitStrings.pop();

        // Validate addresses
        const validAddresses = splitStrings.filter(address => {
            return /^0x[a-fA-F0-9]{40}$/.test(address);
        });

        if (validAddresses.length !== splitStrings.length) {
            // ctx.reply('One or more addresses are invalid.');
        }

        // Remove duplicates
        const uniqueAddresses = [...new Set(validAddresses)];

        // Calculate the start and end date
        const endDate = moment().toISOString();
        const startDate = moment().subtract(days, 'days').toISOString();

        return {
            addressesFull: uniqueAddresses,
            startDate: startDate,
            endDate: endDate
        };
    } catch (error) {
        console.error('Error in parseAndValidateInput:', error.message);
        throw error;
    }
}

module.exports = { parseAndValidateInput }