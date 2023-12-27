const { axiosBitquery } = require('../utils/axiosConfig');


function getCountFromResponse(response) {
  let count = null;
  const deepSearchCount = (obj) => {
    if (obj && typeof obj === 'object') {
      if ('count' in obj) {
        count = obj.count;
        return;
      }
      for (let key in obj) {
        if (count === null) {
          deepSearchCount(obj[key]);
        }
      }
    }
  };
  deepSearchCount(response.data);
  console.log(count);
  return count;
}

async function callBitqueryAPI(endpoint, query, parameters) {
  try {
    const response = await axiosBitquery.post(endpoint, {
      query,
      variables: parameters
    });
    return response.data;
  } catch (error) {
    console.error('Error in callBitqueryAPI:', error);
    throw error;
  }
}

async function prefetchDataLengthFromBitQuery(countQuery, parameters) {
  try {
    const countResponseData = await callBitqueryAPI(countQuery.endpoint, countQuery.query, parameters);
    return getCountFromResponse({ data: countResponseData });
  } catch (error) {
    console.error('Error fetching count from BitQuery:', error);
    throw error;
  }
}

async function fetchDataInParallel(mainQuery, parameters, count) {
  try {
    const limit = parameters.limit;
    const totalPages = Math.ceil(count / limit);

    const promises = Array.from({ length: totalPages }, (_, i) => {
      const offset = i * limit;
      return callBitqueryAPI(mainQuery.endpoint, mainQuery.query, { ...parameters, offset });
    });

    const results = await Promise.all(promises);
    return results;
  } catch (error) {
    console.error('Error fetching data in parallel from BitQuery:', error);
    throw error;
  }
}

module.exports = {
  prefetchDataLengthFromBitQuery, fetchDataInParallel
};
