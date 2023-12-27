require('dotenv').config(); // Load environment variables from .env file
const axios = require('axios');
const rateLimit = require('axios-rate-limit');

// Create an Axios instance for BitQuery
const axiosBitquery = rateLimit(axios.create({
  headers: {
    'X-API-KEY': process.env.BITQUERY_API_KEY
  }
}), {
  maxRequests: process.env.BITQUERY_MAX_REQUESTS,
  perMilliseconds: process.env.BITQUERY_REQUEST_INTERVAL_MS
});

// RPC Provider Rotation Setup
const rpcProviders = process.env.RPC_ENDPOINTS.split(",");
let currentRpcIndex = 0;

function switchRPCProvider() {
  currentRpcIndex = (currentRpcIndex + 1) % rpcProviders.length;
  axiosWeb3.defaults.baseURL = rpcProviders[currentRpcIndex];
}

// Creating axiosWeb3 Instance
const axiosWeb3 = rateLimit(axios.create(), {
  maxRequests: process.env.WEB3_MAX_REQUESTS,
  perMilliseconds: process.env.WEB3_REQUEST_INTERVAL_MS
});

// Interceptor for rate limiting and RPC provider switching
axiosWeb3.interceptors.request.use(config => {
  if (!config.__retryCount) config.__retryCount = 0;

  config.__retryCount += 1;
  
  if (config.__retryCount >= process.env.WEB3_MAX_REQUESTS) {
    switchRPCProvider();
    config.__retryCount = 0;
  }

  return config;
}, error => {
  return Promise.reject(error);
});

// Interceptor for retrying requests
axiosWeb3.interceptors.response.use(undefined, async error => {
  const config = error.config;

  // If config does not exist or the retry option is not set in config, reject
  if(!config || !config.retryOnError) {
    return Promise.reject(error);
  }

  // Set the variable for keeping track of the retry count
  config.__retryCount = config.__retryCount || 0;

  // Check if we've maxed out the total number of retries
  if(config.__retryCount >= config.retryOnError) {
    return Promise.reject(error); // Reject with the error
  }

  config.__retryCount += 1; // Increase the retry count

  // Create new promise to handle exponential backoff
  const backoff = new Promise(function(resolve) {
    setTimeout(function() {
      resolve();
    }, config.retryDelay || 1);
  });

  // Return the promise in which recalls axios to retry the request
  return backoff.then(function() {
    return axiosWeb3(config);
  });
});

// Initialize the baseURL to the first RPC provider
axiosWeb3.defaults.baseURL = rpcProviders[currentRpcIndex];

// Export axiosWeb3 Instance
module.exports = { axiosBitquery, axiosWeb3 };
