const fs = require('fs');
const path = require('path');

// Directory where the files are located
const directory = './'; // Replace with your directory path

// Function to parse the number of tokens from the filename
function parseTokensFromFilename(filename) {
  const parts = filename.split('---');
  return parseInt(parts[1].split('_')[0], 10);
}

// Function to filter wallet addresses
function filterWallets(data, tokenCount) {
  return Object.keys(data).filter(address => data[address] >= tokenCount * 0.1);
}

// Async function to process the files
async function processFiles() {
  let filteredWallets = [];

  fs.readdir(directory, (err, files) => {
    if (err) {
      console.error('Error reading the directory:', err);
      return;
    }

    files.forEach(file => {
      if (file.startsWith('t.me-') && file.endsWith('_tokens.json')) {
        const filePath = path.join(directory, file);
        const tokenCount = parseTokensFromFilename(file);

        fs.readFile(filePath, 'utf8', (err, content) => {
          if (err) {
            console.error(`Error reading file ${file}:`, err);
            return;
          }

          try {
            const data = JSON.parse(content);
            const wallets = filterWallets(data, tokenCount);
            filteredWallets.push(...wallets);
          } catch (error) {
            console.error(`Error parsing JSON from file ${file}:`, error);
          }
        });
      }
    });

    // Save the results after a delay to ensure all files are processed
    setTimeout(() => {
        filteredWallets = [...new Set(filteredWallets)];
      fs.writeFile('filteredWallets.json', JSON.stringify(filteredWallets, null, 2), err => {
        if (err) console.error('Error writing to filteredWallets.json:', err);
        else console.log('Filtered wallets saved to filteredWallets.json');
      });
    }, 5000);
  });
}

processFiles();
