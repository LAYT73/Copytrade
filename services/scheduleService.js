const schedule = require('node-schedule');
const priceGatheringSvc = require('../svcs/priceGatheringSvc');

function init() {

  // run on startup and schedule every 30 minutes
  priceGatheringSvc.updateTokensPrices();
    schedule.scheduleJob('*/30 * * * *', () => {
        priceGatheringSvc.updateTokensPrices();
    });
}

module.exports = {
  init
};
