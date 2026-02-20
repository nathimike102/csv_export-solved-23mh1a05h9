-- Initialize database schema for CSV export service

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    signup_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    country_code CHAR(2) NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    lifetime_value NUMERIC(10, 2) DEFAULT 0.00
);

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_users_country_code ON users(country_code);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_lifetime_value ON users(lifetime_value);

-- Create exports tracking table
CREATE TABLE IF NOT EXISTS exports (
    id UUID PRIMARY KEY,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    filters JSONB,
    columns TEXT[],
    delimiter CHAR(1) DEFAULT ',',
    quote_char CHAR(1) DEFAULT '"',
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    file_path VARCHAR(500),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_exports_status ON exports(status);
CREATE INDEX IF NOT EXISTS idx_exports_created_at ON exports(created_at DESC);
