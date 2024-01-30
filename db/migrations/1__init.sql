CREATE TABLE prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_address TEXT NOT NULL,
    base_symbol TEXT NOT NULL,
    quota_symbol TEXT NOT NULL,
    price REAL NOT NULL,
    date TIMESTAMP NOT NULL,
    CONSTRAINT price_unique UNIQUE (token_address, base_symbol, quota_symbol, date)
);

CREATE UNIQUE INDEX IF NOT EXISTS price_unique ON prices (token_address, base_symbol, quota_symbol, date);
