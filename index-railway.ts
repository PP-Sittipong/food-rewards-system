/**
 * Food Rewards System - Railway Edition
 * Express.js + PostgreSQL
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { getPool } from './db-postgres';
import { validatePhoneNumber } from './utils/validation';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============================================
// API ROUTES
// ============================================

// 1. Register Customer
app.post('/api/v1/register', async (req: Request, res: Response) => {
  try {
    const { phone_number, name, verification_method = 'manual' } = req.body;

    if (!phone_number) {
      return res.status(400).json({ success: false, error: 'phone_number required' });
    }

    if (!validatePhoneNumber(phone_number)) {
      return res.status(400).json({ success: false, error: 'Invalid phone format' });
    }

    const pool = getPool();

    // Check if customer exists
    const existing = await pool.query(
      'SELECT * FROM customers WHERE phone_number = $1',
      [phone_number]
    );

    if (existing.rows.length > 0) {
      const customer = existing.rows[0];
      return res.json({
        success: true,
        message: 'Customer already registered',
        customer_id: customer.customer_id,
        phone_number: customer.phone_number,
        stars_earned: customer.stars_earned,
        total_purchases: customer.total_purchases,
      });
    }

    // Create new customer
    const result = await pool.query(
      `INSERT INTO customers (phone_number, name, verification_method, verified, created_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        phone_number,
        name || 'Unknown',
        verification_method,
        verification_method === 'sms' ? false : true,
        new Date(),
      ]
    );

    const newCustomer = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (action, phone_number, details, ip_address, created_date)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'register',
        phone_number,
        `New customer: ${name || 'Unknown'}`,
        req.ip || 'unknown',
        new Date(),
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      customer_id: newCustomer.customer_id,
      phone_number: newCustomer.phone_number,
      stars_earned: 0,
      verified: newCustomer.verified,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 2. Record Transaction (AUTO INCREMENT STARS)
app.post('/api/v1/transaction', async (req: Request, res: Response) => {
  try {
    const {
      phone_number,
      menu_selected,
      location_id = 'default',
      photo_url,
      gps_latitude,
      gps_longitude,
      photo_timestamp,
      device_id,
    } = req.body;

    if (!phone_number || !menu_selected) {
      return res.status(400).json({
        success: false,
        error: 'phone_number and menu_selected required',
      });
    }

    if (!validatePhoneNumber(phone_number)) {
      return res.status(400).json({ success: false, error: 'Invalid phone' });
    }

    const pool = getPool();

    // Verify customer exists
    const customerResult = await pool.query(
      'SELECT * FROM customers WHERE phone_number = $1',
      [phone_number]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found. Please register first.',
      });
    }

    const customer = customerResult.rows[0];

    // Verify menu exists for today
    const today = new Date().toISOString().split('T')[0];
    const menuResult = await pool.query(
      `SELECT * FROM daily_menu
       WHERE date = $1 AND location_id = $2 AND menu_name = $3 AND is_available = true`,
      [today, location_id, menu_selected]
    );

    if (menuResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: `Menu "${menu_selected}" not available today`,
      });
    }

    const menu = menuResult.rows[0];
    const starsEarned = 1;
    const transactionDate = new Date();

    // Create transaction
    const txResult = await pool.query(
      `INSERT INTO transactions
       (phone_number, location_id, menu_selected, stars_earned, photo_url,
        transaction_date, photo_timestamp, gps_latitude, gps_longitude, device_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING transaction_id`,
      [
        phone_number,
        location_id,
        menu_selected,
        starsEarned,
        photo_url || null,
        transactionDate,
        photo_timestamp || transactionDate,
        gps_latitude || null,
        gps_longitude || null,
        device_id || null,
      ]
    );

    // AUTO: Update customer stars
    const newStars = customer.stars_earned + starsEarned;
    await pool.query(
      `UPDATE customers
       SET stars_earned = $1,
           total_purchases = total_purchases + 1,
           total_revenue = total_revenue + $2,
           last_visit = $3,
           updated_date = $3
       WHERE phone_number = $4`,
      [newStars, menu.price, transactionDate, phone_number]
    );

    // AUTO: Update analytics
    const hour = transactionDate.getHours();
    const existingAnalytics = await pool.query(
      `SELECT * FROM analytics
       WHERE date = $1 AND hour = $2 AND location_id = $3 AND menu_name = $4`,
      [today, hour, location_id, menu_selected]
    );

    if (existingAnalytics.rows.length > 0) {
      await pool.query(
        `UPDATE analytics
         SET units_sold = units_sold + 1,
             total_revenue = total_revenue + $1,
             total_cost = total_cost + $2,
             updated_date = $3
         WHERE date = $4 AND hour = $5 AND location_id = $6 AND menu_name = $7`,
        [
          menu.price,
          menu.cost,
          transactionDate,
          today,
          hour,
          location_id,
          menu_selected,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO analytics
         (date, hour, location_id, menu_name, units_sold, total_revenue, total_cost, updated_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [today, hour, location_id, menu_selected, 1, menu.price, menu.cost, transactionDate]
      );
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (action, phone_number, details, ip_address, created_date)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'purchase',
        phone_number,
        `Purchased: ${menu_selected} at ${location_id}`,
        req.ip || 'unknown',
        transactionDate,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Transaction recorded successfully',
      transaction_id: txResult.rows[0].transaction_id,
      stars_earned: starsEarned,
      total_stars: newStars,
      menu: menu_selected,
      price: menu.price,
      reward_ready: newStars >= 10,
      stars_to_reward: Math.max(0, 10 - newStars),
    });
  } catch (error) {
    console.error('Transaction error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 3. Get Customer Info
app.get('/api/v1/customer/:phone', async (req: Request, res: Response) => {
  try {
    const phone = req.params.phone;

    if (!validatePhoneNumber(phone)) {
      return res.status(400).json({ success: false, error: 'Invalid phone' });
    }

    const pool = getPool();

    const customerResult = await pool.query(
      'SELECT * FROM customers WHERE phone_number = $1',
      [phone]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const customer = customerResult.rows[0];

    // Get transactions
    const transactionsResult = await pool.query(
      `SELECT menu_selected, transaction_date, location_id FROM transactions
       WHERE phone_number = $1
       ORDER BY transaction_date DESC
       LIMIT 10`,
      [phone]
    );

    // Get menu preferences
    const preferencesResult = await pool.query(
      `SELECT menu_selected, COUNT(*) as count FROM transactions
       WHERE phone_number = $1
       GROUP BY menu_selected
       ORDER BY count DESC`,
      [phone]
    );

    return res.json({
      success: true,
      customer: {
        customer_id: customer.customer_id,
        phone_number: customer.phone_number,
        name: customer.name,
        stars_earned: customer.stars_earned,
        total_purchases: customer.total_purchases,
        total_spent: customer.total_revenue,
        verified: customer.verified,
        last_visit: customer.last_visit,
        joined_date: customer.created_date,
      },
      rewards: {
        reward_ready: customer.stars_earned >= 10,
        stars_to_reward: Math.max(0, 10 - customer.stars_earned),
        next_reward_at: 10,
      },
      menu_preferences: preferencesResult.rows,
      recent_transactions: transactionsResult.rows,
    });
  } catch (error) {
    console.error('Customer error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 4. Get Analytics
app.get('/api/v1/analytics/:location/:date', async (req: Request, res: Response) => {
  try {
    const { location, date } = req.params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    const pool = getPool();

    const analyticsResult = await pool.query(
      `SELECT * FROM analytics
       WHERE date = $1 AND location_id = $2
       ORDER BY hour ASC`,
      [date, location]
    );

    const totalsResult = await pool.query(
      `SELECT
         SUM(units_sold) as total_units,
         SUM(total_revenue) as total_revenue,
         SUM(total_cost) as total_cost,
         COUNT(DISTINCT menu_name) as menu_count
       FROM analytics
       WHERE date = $1 AND location_id = $2`,
      [date, location]
    );

    const topMenusResult = await pool.query(
      `SELECT menu_name, units_sold, total_revenue
       FROM analytics
       WHERE date = $1 AND location_id = $2
       ORDER BY units_sold DESC
       LIMIT 5`,
      [date, location]
    );

    const totals = totalsResult.rows[0];

    return res.json({
      success: true,
      date,
      location,
      summary: {
        total_units: totals?.total_units || 0,
        total_revenue: totals?.total_revenue || 0,
        total_cost: totals?.total_cost || 0,
        profit: (totals?.total_revenue || 0) - (totals?.total_cost || 0),
        unique_menus: totals?.menu_count || 0,
      },
      hourly_breakdown: analyticsResult.rows,
      top_menus: topMenusResult.rows,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api/v1`);
  console.log(`❤️ Health: http://localhost:${PORT}/health`);
});

export default app;
