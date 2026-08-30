-- ============================================
-- PostgreSQL Schema for Food Rewards System
-- (Railway compatible)
-- ============================================

-- 1. CUSTOMERS (สมาชิก)
CREATE TABLE IF NOT EXISTS customers (
  customer_id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100),
  stars_earned INTEGER DEFAULT 0,
  total_purchases INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0,
  rewards_redeemed INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  verification_method VARCHAR(20) DEFAULT 'manual',
  last_visit TIMESTAMP,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TRANSACTIONS (บันทึกการซื้อ)
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  location_id VARCHAR(50),
  menu_selected VARCHAR(100) NOT NULL,
  stars_earned INTEGER DEFAULT 1,
  photo_url VARCHAR(500),
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  photo_timestamp TIMESTAMP,
  gps_latitude DECIMAL(10,8),
  gps_longitude DECIMAL(11,8),
  device_id VARCHAR(100),
  notes TEXT,
  FOREIGN KEY (phone_number) REFERENCES customers(phone_number)
);

-- 3. DAILY_MENU (เมนูรายวัน)
CREATE TABLE IF NOT EXISTS daily_menu (
  menu_id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  location_id VARCHAR(50) NOT NULL,
  menu_name VARCHAR(100) NOT NULL,
  price INTEGER,
  cost INTEGER,
  description TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, location_id, menu_name)
);

-- 4. ANALYTICS (สถิติรวม)
CREATE TABLE IF NOT EXISTS analytics (
  analytics_id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  hour INTEGER,
  location_id VARCHAR(50) NOT NULL,
  menu_name VARCHAR(100) NOT NULL,
  units_sold INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0,
  total_cost INTEGER DEFAULT 0,
  avg_stars DECIMAL(5,2) DEFAULT 0,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, hour, location_id, menu_name)
);

-- 5. REWARDS (รางวัล)
CREATE TABLE IF NOT EXISTS rewards (
  reward_id SERIAL PRIMARY KEY,
  reward_code VARCHAR(50) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  stars_used INTEGER DEFAULT 10,
  reward_type VARCHAR(50),
  reward_value INTEGER,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  redeemed_date TIMESTAMP,
  is_redeemed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  FOREIGN KEY (phone_number) REFERENCES customers(phone_number)
);

-- 6. AUDIT_LOG (บันทึกการเปลี่ยนแปลง)
CREATE TABLE IF NOT EXISTS audit_log (
  log_id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  phone_number VARCHAR(20),
  details TEXT,
  ip_address VARCHAR(50),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_customers_phone ON customers(phone_number);
CREATE INDEX idx_customers_created ON customers(created_date);
CREATE INDEX idx_transactions_phone ON transactions(phone_number);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_location ON transactions(location_id);
CREATE INDEX idx_analytics_date ON analytics(date);
CREATE INDEX idx_analytics_location ON analytics(location_id);
CREATE INDEX idx_rewards_phone ON rewards(phone_number);
CREATE INDEX idx_rewards_code ON rewards(reward_code);
