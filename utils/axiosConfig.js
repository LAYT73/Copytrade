require('dotenv').config(); // Load environment variables from .env file
const axios = require('axios');
const rateLimit = require('axios-rate-limit');

// Create an Axios instance for Binance
const axiosBinance = rateLimit(axios.create(), {
  maxRequests: process.env.BINANCE_MAX_REQUESTS || 10,
  perMilliseconds: process.env.BINANCE_REQUEST_INTERVAL_MS || 1000
});

// Create an Axios instance for BitQuery
const axiosBitquery = rateLimit(axios.create({
  headers: {
    'X-API-KEY': process.env.BITQUERY_API_KEY
  }
}), {
  maxRequests: process.env.BITQUERY_MAX_REQUESTS,
  perMilliseconds: process.env.BITQUERY_REQUEST_INTERVAL_MS
});

// Create an Axios instance for Moralis
const axiosMoralis = rateLimit(axios.create({
  headers: {
    'X-API-KEY': process.env.MORALIS_API_KEY
  }
}), {
  maxRequests: process.env.MORALIS_MAX_REQUESTS,
  perMilliseconds: process.env.MORALIS_REQUEST_INTERVAL_MS
});

// Create an Axios instance for DexGuru
const axiosDexguru = rateLimit(axios.create({
  headers: {
    'api-key': process.env.DEXGURU_API_KEY
  }
}), {
  maxRequests: process.env.DEXGURU_MAX_REQUESTS,
  perMilliseconds: process.env.DEXGURU_REQUEST_INTERVAL_MS
});

module.exports = {
  axiosBinance,
  axiosBitquery,
  axiosMoralis,
  axiosDexguru
};
