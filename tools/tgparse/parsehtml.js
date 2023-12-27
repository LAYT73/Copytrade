const fs = require('fs');
const cheerio = require('cheerio');
const path = require('path');


const convertToISO8601 = (timestamp) => {
  const datePart = timestamp.slice(0, 10); // "DD.MM.YYYY"
  const timePart = timestamp.slice(11, 19); // "HH:MM:SS"
  const timezonePart = timestamp.slice(20); // "UTC+HH:MM"
  const [day, month, year] = datePart.split('.');
  const formattedTimezone = timezonePart.replace('UTC', '').replace(':', '');
  return `${year}-${month}-${day}T${timePart}${formattedTimezone}`;
};

const parseHTML = (htmlContent) => {
    const $ = cheerio.load(htmlContent);
    const ethereumAddresses = {};

    $('.message').each((i, element) => {
        const timestampDiv = $(element).find('.pull_right.date.details');
        const textDiv = $(element).find('.text');

        if (timestampDiv.length && timestampDiv.attr('title') && textDiv) {
            const timestamp = timestampDiv.attr('title');
            const text = textDiv.text();
            const parsedTimestamp = convertToISO8601(timestamp);

            const regex = /0x[a-fA-F0-9]{40}/g;          
            let match;
            while ((match = regex.exec(text)) !== null) {              
                if (!ethereumAddresses[match[0]]) {                  
                    ethereumAddresses[match[0]] = parsedTimestamp;
                    console.log(ethereumAddresses[match[0]]);
                    console.log(parsedTimestamp);
                }
            }
        }
    });

    return ethereumAddresses;
};

async function processFile(filePath) {
  const data = await fs.promises.readFile(filePath, 'utf8');
  return data;
}
async function checkAndProcessFiles(directoryPath, baseFilename) {
  let fileIndex = 0;
  let combinedData = "";

  while (true) {
      let filename;
      if (fileIndex === 0) {
          filename = `${baseFilename}.html`;
      } else {
          filename = `${baseFilename}${fileIndex + 1}.html`;
      }

      const filePath = path.join(directoryPath, filename);
      if (!fs.existsSync(filePath)) {
          console.log(`No more files found after ${filename}. Exiting.`);
          break;
      }

      console.log(`Processing file: ${filename}`);
      const fileData = await processFile(filePath);
      combinedData += fileData;
      fileIndex++;
  }

  const parsedData = parseHTML(combinedData);
  await fs.promises.writeFile(path.join(directoryPath, 'output.json'), JSON.stringify(parsedData, null, 2));
  return parsedData;
}



module.exports = {checkAndProcessFiles};