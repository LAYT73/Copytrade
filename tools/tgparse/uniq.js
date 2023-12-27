const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

async function loadWallets() {
    // Read wallets from JSON file
    const filteredWallets = JSON.parse(fs.readFileSync('./filteredWallets.json', 'utf8'));
    let newWallets = new Set(filteredWallets);

    // Directory containing the Excel files
    const directoryPath = 'c:\\DEV\\ethereum_screener\\src\\excel_dump\\';

    // Read all file names in the directory
    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
        // Check if the file is an Excel file
        if (path.extname(file) === '.xlsx') {
            // Load the workbook
            const workbook = xlsx.readFile(path.join(directoryPath, file));

            // Get the first worksheet
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];

            // Read each row in the first column, skipping the header
            for (let row = 2; worksheet[`A${row}`]; row++) {
                const walletAddress = worksheet[`A${row}`].v;
                console.log(walletAddress);
                newWallets.delete(walletAddress); // Remove wallet if it exists in the set
            }
        }
    }

    // Convert the set back to an array
    return Array.from(newWallets);
}

loadWallets().then(uniqueWallets => {
    console.log('Unique Wallets:', uniqueWallets);

    // Write the unique wallets to a file
    fs.writeFileSync('uniqueWallets.json', JSON.stringify(uniqueWallets, null, 2), 'utf8');
    console.log('Unique wallets have been saved to uniqueWallets.json');
});
