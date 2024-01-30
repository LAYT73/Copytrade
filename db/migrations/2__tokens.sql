CREATE TABLE tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    address TEXT NOT NULL,
    chain TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    last_price_update_date TIMESTAMP,
    CONSTRAINT unique_token_pair UNIQUE (address, chain)
);
