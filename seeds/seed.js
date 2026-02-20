#!/usr/bin/env node

/**
 * Database seeding script
 * Generates 10 million rows of test data efficiently
 */

const { Client } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'exporter',
  password: process.env.DB_PASSWORD || 'secret',
  database: process.env.DB_NAME || 'exports_db'
};

const TOTAL_ROWS = 10000000;
const BATCH_SIZE = 10000;
const COUNTRIES = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'IN', 'BR', 'MX'];
const TIERS = ['free', 'basic', 'premium', 'enterprise'];

async function seed() {
  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if data already exists
    const countResult = await client.query('SELECT COUNT(*) FROM users');
    const existingCount = parseInt(countResult.rows[0].count);

    if (existingCount > 0) {
      console.log(`Database already contains ${existingCount} users. Skipping seed.`);
      await client.end();
      return;
    }

    console.log(`Seeding ${TOTAL_ROWS.toLocaleString()} rows...`);
    
    // Use PostgreSQL's generate_series for efficient bulk insert
    const seedQuery = `
      INSERT INTO users (name, email, signup_date, country_code, subscription_tier, lifetime_value)
      SELECT
        'User ' || num,
        'user' || num || '@example.com',
        CURRENT_TIMESTAMP - (RANDOM() * INTERVAL '365 days'),
        $1[((num - 1) % array_length($1, 1)) + 1],
        $2[((num - 1) % array_length($2, 1)) + 1],
        ROUND((RANDOM() * 10000)::NUMERIC, 2)
      FROM generate_series(1, $3) AS gs(num)
    `;

    await client.query(seedQuery, [COUNTRIES, TIERS, TOTAL_ROWS]);
    
    console.log(`✓ Successfully inserted ${TOTAL_ROWS.toLocaleString()} rows`);

    // Verify count
    const finalCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`✓ Final row count: ${finalCount.rows[0].count.toLocaleString()}`);

  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
