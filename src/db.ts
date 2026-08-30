import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100),
    location VARCHAR(100),
    stars_earned INTEGER DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    total_revenue INTEGER DEFAULT 0,
    rewards_redeemed INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    verification_method VARCHAR(20) DEFAULT 'manual',
    last_visit TIMESTAMP,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS transactions (
    transaction_id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    location VARCHAR(100),
    menu_selected VARCHAR(100) NOT NULL,
    price INTEGER DEFAULT 0,
    stars_earned INTEGER DEFAULT 1,
    device_id VARCHAR(100),
    photo_url VARCHAR(500),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    gps_latitude DECIMAL(10,8),
    gps_longitude DECIMAL(11,8),
    notes TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS daily_menu (
    menu_id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    location VARCHAR(100) NOT NULL DEFAULT 'main',
    menu_name VARCHAR(100) NOT NULL,
    price INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, location, menu_name)
  )`,
  `CREATE TABLE IF NOT EXISTS rewards (
    reward_id SERIAL PRIMARY KEY,
    reward_code VARCHAR(50) UNIQUE NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    stars_used INTEGER DEFAULT 10,
    reward_type VARCHAR(50) DEFAULT 'free_box',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    redeemed_date TIMESTAMP,
    is_redeemed BOOLEAN DEFAULT FALSE,
    notes TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    log_id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20),
    details TEXT,
    ip_address VARCHAR(50),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  // Columns added defensively for databases created by the older schema file.
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS location VARCHAR(100)`,
  `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location VARCHAR(100)`,
  `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS price INTEGER DEFAULT 0`,
  `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS device_id VARCHAR(100)`,
  `CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_phone ON transactions(phone_number)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)`,
  `CREATE INDEX IF NOT EXISTS idx_rewards_phone ON rewards(phone_number)`,
  `CREATE INDEX IF NOT EXISTS idx_rewards_code ON rewards(reward_code)`,
];

export async function ensureSchema(): Promise<void> {
  for (const sql of STATEMENTS) {
    await pool.query(sql);
  }
  console.log('Database schema is ready');
}

export async function waitForDatabase(maxAttempts = 20): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      console.log(`Waiting for database (attempt ${attempt}/${maxAttempts})...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  throw new Error('Database is not reachable');
}
