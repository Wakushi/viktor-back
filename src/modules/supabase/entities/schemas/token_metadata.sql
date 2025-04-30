CREATE TABLE token_metadata (
    id BIGSERIAL PRIMARY KEY,
    token_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    weth_pool_address VARCHAR(255),
    usdc_pool_address VARCHAR(255),
    chain TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);