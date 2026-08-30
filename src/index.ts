import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';

const app: Express = express();
const port = process.env.PORT || 3000;

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/v1/register - Customer registration
app.post('/api/v1/register', async (req: Request, res: Response) => {
  try {
    const { phone, name, location } = req.body;

    // Validate input
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Check if customer already exists
    const checkQuery = 'SELECT * FROM customers WHERE phone_number = $1';
    const checkResult = await pool.query(checkQuery, [phone]);

    if (checkResult.rows.length > 0) {
      // Customer exists, return existing data
      return res.json({
        customer_id: checkResult.rows[0].customer_id,
        phone: checkResult.rows[0].phone_number,
        name: checkResult.rows[0].name,
        stars: checkResult.rows[0].stars_earned,
        message: 'Customer already registered',
        is_new: false,
      });
    }

    // Create new customer
    const insertQuery =
      'INSERT INTO customers (phone_number, name, location, stars_earned) VALUES ($1, $2, $3, $4) RETURNING *';
    const result = await pool.query(insertQuery, [phone, name || null, location || null, 0]);

    res.status(201).json({
      customer_id: result.rows[0].customer_id,
      phone: result.rows[0].phone_number,
      name: result.rows[0].name,
      stars: 0,
      message: 'Customer registered successfully',
      is_new: true,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register customer' });
  }
});

// POST /api/v1/transaction - Record purchase with auto-calculated stars
app.post('/api/v1/transaction', async (req: Request, res: Response) => {
  try {
    const { phone, menu, price, location, gps_latitude, gps_longitude } = req.body;

    if (!phone || !menu || !price) {
      return res.status(400).json({ error: 'Phone, menu, and price are required' });
    }

    // Validate GPS coordinates if provided
    if (gps_latitude !== undefined && gps_longitude !== undefined) {
      if (gps_latitude < -90 || gps_latitude > 90 || gps_longitude < -180 || gps_longitude > 180) {
        return res.status(400).json({ error: 'Invalid GPS coordinates' });
      }
    }

    // Get customer
    const customerQuery = 'SELECT * FROM customers WHERE phone_number = $1';
    const customerResult = await pool.query(customerQuery, [phone]);

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = customerResult.rows[0];

    // Calculate stars: 1 star per 100 baht
    const stars_earned = Math.floor(price / 100);

    // Record transaction
    const transactionQuery = `
      INSERT INTO transactions (phone_number, menu_selected, price, location, gps_latitude, gps_longitude, transaction_date, stars_earned)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      RETURNING *
    `;
    const transactionResult = await pool.query(transactionQuery, [
      phone,
      menu,
      price,
      location || null,
      gps_latitude || null,
      gps_longitude || null,
      stars_earned,
    ]);

    // Update customer stars
    const newStars = customer.stars_earned + stars_earned;
    const updateQuery = 'UPDATE customers SET stars_earned = $1, last_visit = NOW() WHERE phone_number = $2';
    await pool.query(updateQuery, [newStars, phone]);

    // Check if reward is ready (10 stars = 1 reward)
    const reward_ready = newStars >= 10;

    res.status(201).json({
      transaction_id: transactionResult.rows[0].transaction_id,
      phone: phone,
      menu: menu,
      price: price,
      stars_earned: stars_earned,
      total_stars: newStars,
      reward_ready: reward_ready,
      stars_to_reward: reward_ready ? 0 : 10 - newStars,
      message: reward_ready ? 'Customer is eligible for reward!' : 'Stars recorded successfully',
    });
  } catch (error) {
    console.error('Transaction error:', error);
    res.status(500).json({ error: 'Failed to record transaction' });
  }
});

// GET /api/v1/customer/:phone - Get customer info and star balance
app.get('/api/v1/customer/:phone', async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;

    const query = `
      SELECT
        customer_id,
        phone_number,
        name,
        stars_earned,
        total_purchases,
        created_date,
        last_visit,
        verified
      FROM customers
      WHERE phone_number = $1
    `;
    const result = await pool.query(query, [phone]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = result.rows[0];

    // Get recent transactions
    const transactionsQuery = `
      SELECT menu_selected, price, stars_earned, transaction_date
      FROM transactions
      WHERE phone_number = $1
      ORDER BY transaction_date DESC
      LIMIT 10
    `;
    const transactionsResult = await pool.query(transactionsQuery, [phone]);

    res.json({
      customer_id: customer.customer_id,
      phone: customer.phone_number,
      name: customer.name,
      stars: customer.stars_earned,
      total_purchases: customer.total_purchases,
      created_date: customer.created_date,
      last_visit: customer.last_visit,
      verified: customer.verified,
      recent_transactions: transactionsResult.rows,
    });
  } catch (error) {
    console.error('Customer query error:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// GET /api/v1/analytics/:location/:date - Sales analytics for location and date
app.get('/api/v1/analytics/:location/:date', async (req: Request, res: Response) => {
  try {
    const { location, date } = req.params;

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const query = `
      SELECT
        DATE(transaction_date) as date,
        location,
        menu_selected,
        COUNT(*) as units_sold,
        SUM(price) as total_revenue,
        SUM(stars_earned) as total_stars
      FROM transactions
      WHERE location = $1 AND DATE(transaction_date) = $2
      GROUP BY DATE(transaction_date), location, menu_selected
      ORDER BY total_revenue DESC
    `;

    const result = await pool.query(query, [location, date]);

    if (result.rows.length === 0) {
      return res.json({
        date: date,
        location: location,
        summary: {
          total_units: 0,
          total_revenue: 0,
          total_stars: 0,
        },
        items: [],
      });
    }

    // Calculate summary
    const summary = {
      total_units: result.rows.reduce((sum: number, row: any) => sum + parseInt(row.units_sold), 0),
      total_revenue: result.rows.reduce((sum: number, row: any) => sum + parseInt(row.total_revenue), 0),
      total_stars: result.rows.reduce((sum: number, row: any) => sum + parseInt(row.total_stars), 0),
    };

    res.json({
      date: date,
      location: location,
      summary: summary,
      items: result.rows,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Food Rewards System running on port ${port}`);
});
