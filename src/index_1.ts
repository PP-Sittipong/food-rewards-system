import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { pool, ensureSchema, waitForDatabase } from './db';
import { homePage, staffPage, dashboardPage } from './web';

const app: Express = express();
const port = process.env.PORT || 3000;
const STARS_PER_REWARD = 10;

app.use(cors());
app.use(express.json());

// ---------- helpers ----------

function todayBkk(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const LOCAL_DATE = `(transaction_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date`;

function cleanPhone(value: any): string {
  return String(value || '').replace(/\D/g, '');
}

function toInt(value: any): number {
  const n = parseInt(String(value), 10);
  return isNaN(n) ? 0 : n;
}

async function getCustomer(phone: string): Promise<any | null> {
  const r = await pool.query('SELECT * FROM customers WHERE phone_number = $1', [phone]);
  return r.rows.length ? r.rows[0] : null;
}

async function log(action: string, phone: string | null, details: string): Promise<void> {
  try {
    await pool.query('INSERT INTO audit_log (action, phone_number, details) VALUES ($1,$2,$3)', [
      action,
      phone,
      details,
    ]);
  } catch (e) {
    console.error('audit log failed', e);
  }
}

// ---------- pages ----------

app.get('/', (_req: Request, res: Response) => res.type('html').send(homePage()));
app.get('/staff', (_req: Request, res: Response) => res.type('html').send(staffPage()));
app.get('/dashboard', (_req: Request, res: Response) => res.type('html').send(dashboardPage()));
app.get('/favicon.ico', (_req: Request, res: Response) => res.status(204).end());
app.get('/health', (_req: Request, res: Response) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString(), today: todayBkk() })
);

// ---------- core: one star per customer per day ----------

async function handleCheckin(req: Request, res: Response): Promise<any> {
  try {
    const phone = cleanPhone(req.body.phone);
    const { name, menu, location, gps_latitude, gps_longitude, device_id } = req.body;
    const price = toInt(req.body.price);

    if (phone.length < 9) {
      return res.status(400).json({ error: 'เบอร์โทรไม่ถูกต้อง' });
    }

    let customer = await getCustomer(phone);
    if (!customer) {
      const created = await pool.query(
        `INSERT INTO customers (phone_number, name, location, stars_earned, total_purchases, total_revenue)
         VALUES ($1,$2,$3,0,0,0) RETURNING *`,
        [phone, name || null, location || null]
      );
      customer = created.rows[0];
    } else if (name && !customer.name) {
      await pool.query('UPDATE customers SET name = $1 WHERE phone_number = $2', [name, phone]);
      customer.name = name;
    }

    const today = todayBkk();
    const dup = await pool.query(
      `SELECT 1 FROM transactions
       WHERE ${LOCAL_DATE} = $1 AND (phone_number = $2 OR (device_id IS NOT NULL AND device_id = $3))
       LIMIT 1`,
      [today, phone, device_id || null]
    );

    if (dup.rows.length > 0) {
      return res.json({
        phone,
        name: customer.name,
        stars: customer.stars_earned,
        awarded: false,
        reward_ready: customer.stars_earned >= STARS_PER_REWARD,
        stars_to_reward: Math.max(0, STARS_PER_REWARD - customer.stars_earned),
        message: 'วันนี้รับดาวไปแล้ว พรุ่งนี้มาใหม่นะ',
      });
    }

    await pool.query(
      `INSERT INTO transactions
       (phone_number, menu_selected, price, location, stars_earned, device_id, gps_latitude, gps_longitude)
       VALUES ($1,$2,$3,$4,1,$5,$6,$7)`,
      [
        phone,
        menu || 'ไม่ระบุเมนู',
        price,
        location || null,
        device_id || null,
        gps_latitude || null,
        gps_longitude || null,
      ]
    );

    const updated = await pool.query(
      `UPDATE customers
       SET stars_earned = stars_earned + 1,
           total_purchases = total_purchases + 1,
           total_revenue = total_revenue + $2,
           last_visit = NOW(),
           updated_date = NOW()
       WHERE phone_number = $1 RETURNING *`,
      [phone, price]
    );

    const stars = updated.rows[0].stars_earned;
    const ready = stars >= STARS_PER_REWARD;
    await log('checkin', phone, 'menu=' + (menu || '-') + ' price=' + price);

    res.status(201).json({
      phone,
      name: updated.rows[0].name,
      stars,
      awarded: true,
      reward_ready: ready,
      stars_to_reward: Math.max(0, STARS_PER_REWARD - stars),
      message: ready ? 'ได้ 1 ดาว! ครบ 10 ดาวแล้ว แลกข้าวฟรีได้เลย' : 'ได้ 1 ดาว! ขอบคุณค่ะ',
    });
  } catch (error) {
    console.error('Checkin error:', error);
    res.status(500).json({ error: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง' });
  }
}

app.post('/api/v1/checkin', handleCheckin);

app.get('/api/v1/customer/:phone', async (req: Request, res: Response) => {
  try {
    const phone = cleanPhone(req.params.phone);
    const customer = await getCustomer(phone);
    if (!customer) return res.status(404).json({ error: 'ไม่พบเบอร์นี้ในระบบ' });

    const tx = await pool.query(
      `SELECT menu_selected, price, stars_earned, transaction_date
       FROM transactions WHERE phone_number = $1 ORDER BY transaction_date DESC LIMIT 10`,
      [phone]
    );

    res.json({
      customer_id: customer.customer_id,
      phone: customer.phone_number,
      name: customer.name,
      stars: customer.stars_earned,
      total_purchases: customer.total_purchases,
      total_revenue: customer.total_revenue,
      rewards_redeemed: customer.rewards_redeemed,
      last_visit: customer.last_visit,
      reward_ready: customer.stars_earned >= STARS_PER_REWARD,
      stars_to_reward: Math.max(0, STARS_PER_REWARD - customer.stars_earned),
      recent_transactions: tx.rows,
    });
  } catch (error) {
    console.error('Customer error:', error);
    res.status(500).json({ error: 'ดึงข้อมูลไม่สำเร็จ' });
  }
});

// ---------- rewards ----------

async function newRewardCode(): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const taken = await pool.query(
      'SELECT 1 FROM rewards WHERE reward_code = $1 AND is_redeemed = FALSE',
      [code]
    );
    if (taken.rows.length === 0) {
      await pool.query('DELETE FROM rewards WHERE reward_code = $1', [code]);
      return code;
    }
  }
  return String(Date.now()).slice(-6);
}

app.post('/api/v1/redeem', async (req: Request, res: Response) => {
  try {
    const phone = cleanPhone(req.body.phone);
    const customer = await getCustomer(phone);
    if (!customer) return res.status(404).json({ error: 'ไม่พบเบอร์นี้ในระบบ' });
    if (customer.stars_earned < STARS_PER_REWARD) {
      return res.status(400).json({
        error: 'ดาวยังไม่ครบ 10 ดวง (ตอนนี้ ' + customer.stars_earned + ' ดวง)',
      });
    }

    const code = await newRewardCode();
    await pool.query(
      `INSERT INTO rewards (reward_code, phone_number, stars_used, reward_type)
       VALUES ($1,$2,$3,'free_box')`,
      [code, phone, STARS_PER_REWARD]
    );
    const updated = await pool.query(
      `UPDATE customers SET stars_earned = stars_earned - $2, updated_date = NOW()
       WHERE phone_number = $1 RETURNING stars_earned`,
      [phone, STARS_PER_REWARD]
    );
    await log('redeem', phone, 'code=' + code);

    res.status(201).json({
      reward_code: code,
      phone,
      stars_left: updated.rows[0].stars_earned,
      message: 'โชว์รหัสนี้ให้พนักงานเพื่อรับข้าวฟรี 1 กล่อง',
    });
  } catch (error) {
    console.error('Redeem error:', error);
    res.status(500).json({ error: 'แลกไม่สำเร็จ ลองใหม่อีกครั้ง' });
  }
});

app.post('/api/v1/redeem/confirm', async (req: Request, res: Response) => {
  try {
    const code = String(req.body.code || '').trim();
    const found = await pool.query('SELECT * FROM rewards WHERE reward_code = $1', [code]);
    if (found.rows.length === 0) return res.status(404).json({ error: 'ไม่พบรหัสนี้' });
    if (found.rows[0].is_redeemed) return res.status(400).json({ error: 'รหัสนี้ถูกใช้ไปแล้ว' });

    await pool.query(
      'UPDATE rewards SET is_redeemed = TRUE, redeemed_date = NOW() WHERE reward_code = $1',
      [code]
    );
    const phone = found.rows[0].phone_number;
    await pool.query(
      'UPDATE customers SET rewards_redeemed = rewards_redeemed + 1 WHERE phone_number = $1',
      [phone]
    );
    const customer = await getCustomer(phone);
    await log('redeem_confirm', phone, 'code=' + code);

    res.json({ ok: true, phone, name: customer ? customer.name : null, message: 'ตัดรหัสเรียบร้อย' });
  } catch (error) {
    console.error('Confirm error:', error);
    res.status(500).json({ error: 'ตรวจรหัสไม่สำเร็จ' });
  }
});

// ---------- daily menu ----------

app.get('/api/v1/menu/today', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(
      'SELECT menu_name, price FROM daily_menu WHERE date = $1 AND is_available = TRUE ORDER BY menu_id',
      [todayBkk()]
    );
    res.json({ date: todayBkk(), items: r.rows });
  } catch (error) {
    console.error('Menu error:', error);
    res.status(500).json({ error: 'ดึงเมนูไม่สำเร็จ' });
  }
});

app.post('/api/v1/menu', async (req: Request, res: Response) => {
  try {
    const menu_name = String(req.body.menu_name || '').trim();
    if (!menu_name) return res.status(400).json({ error: 'ต้องใส่ชื่อเมนู' });
    const price = toInt(req.body.price);
    const date = req.body.date || todayBkk();
    const location = req.body.location || 'main';

    await pool.query(
      `INSERT INTO daily_menu (date, location, menu_name, price)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (date, location, menu_name)
       DO UPDATE SET price = EXCLUDED.price, is_available = TRUE`,
      [date, location, menu_name, price]
    );
    res.status(201).json({ ok: true, date, menu_name, price });
  } catch (error) {
    console.error('Menu save error:', error);
    res.status(500).json({ error: 'บันทึกเมนูไม่สำเร็จ' });
  }
});

// ---------- analytics ----------

app.get('/api/v1/summary', async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || todayBkk();
    const r = await pool.query(
      `SELECT menu_selected AS menu, COUNT(*)::int AS units,
              COALESCE(SUM(price),0)::int AS revenue,
              COUNT(DISTINCT phone_number)::int AS customers
       FROM transactions WHERE ${LOCAL_DATE} = $1
       GROUP BY menu_selected ORDER BY revenue DESC`,
      [date]
    );
    const people = await pool.query(
      `SELECT COUNT(DISTINCT phone_number)::int AS c FROM transactions WHERE ${LOCAL_DATE} = $1`,
      [date]
    );
    const items: any[] = r.rows;
    res.json({
      date,
      summary: {
        total_units: items.reduce((s: number, x: any) => s + x.units, 0),
        total_revenue: items.reduce((s: number, x: any) => s + x.revenue, 0),
        customers: people.rows[0].c,
      },
      items,
    });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: 'ดึงสถิติไม่สำเร็จ' });
  }
});

app.get('/api/v1/stats', async (_req: Request, res: Response) => {
  try {
    const best = await pool.query(
      `SELECT menu_selected AS menu, COUNT(*)::int AS units, COALESCE(SUM(price),0)::int AS revenue
       FROM transactions WHERE ${LOCAL_DATE} >= (CURRENT_DATE - INTERVAL '6 days')
       GROUP BY menu_selected ORDER BY units DESC LIMIT 10`
    );
    const daily = await pool.query(
      `SELECT to_char(${LOCAL_DATE}, 'YYYY-MM-DD') AS date,
              COUNT(*)::int AS units, COALESCE(SUM(price),0)::int AS revenue
       FROM transactions WHERE ${LOCAL_DATE} >= (CURRENT_DATE - INTERVAL '6 days')
       GROUP BY 1 ORDER BY 1 DESC`
    );
    const top = await pool.query(
      `SELECT phone_number AS phone, name, total_purchases::int AS visits, stars_earned::int AS stars
       FROM customers ORDER BY total_purchases DESC LIMIT 10`
    );
    res.json({
      best_menu: best.rows,
      daily: daily.rows,
      top_customers: top.rows,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'ดึงสถิติไม่สำเร็จ' });
  }
});

// ---------- legacy endpoints (kept for the earlier API docs) ----------

app.post('/api/v1/register', async (req: Request, res: Response) => {
  try {
    const phone = cleanPhone(req.body.phone);
    if (phone.length < 9) return res.status(400).json({ error: 'Phone number is required' });
    const existing = await getCustomer(phone);
    if (existing) {
      return res.json({
        customer_id: existing.customer_id,
        phone: existing.phone_number,
        name: existing.name,
        stars: existing.stars_earned,
        message: 'Customer already registered',
        is_new: false,
      });
    }
    const r = await pool.query(
      'INSERT INTO customers (phone_number, name, location, stars_earned) VALUES ($1,$2,$3,0) RETURNING *',
      [phone, req.body.name || null, req.body.location || null]
    );
    res.status(201).json({
      customer_id: r.rows[0].customer_id,
      phone: r.rows[0].phone_number,
      name: r.rows[0].name,
      stars: 0,
      message: 'Customer registered successfully',
      is_new: true,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register customer' });
  }
});

app.post('/api/v1/transaction', async (req: Request, res: Response) => {
  req.body.device_id = req.body.device_id || 'staff-entry-' + Date.now();
  return handleCheckin(req, res);
});

app.get('/api/v1/analytics/:location/:date', async (req: Request, res: Response) => {
  try {
    const { location, date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    const r = await pool.query(
      `SELECT menu_selected, COUNT(*)::int AS units_sold,
              COALESCE(SUM(price),0)::int AS total_revenue,
              COALESCE(SUM(stars_earned),0)::int AS total_stars
       FROM transactions
       WHERE ${LOCAL_DATE} = $1 AND ($2 = 'all' OR COALESCE(location,'main') = $2)
       GROUP BY menu_selected ORDER BY total_revenue DESC`,
      [date, location]
    );
    const rows: any[] = r.rows;
    res.json({
      date,
      location,
      summary: {
        total_units: rows.reduce((s: number, x: any) => s + x.units_sold, 0),
        total_revenue: rows.reduce((s: number, x: any) => s + x.total_revenue, 0),
        total_stars: rows.reduce((s: number, x: any) => s + x.total_stars, 0),
      },
      items: rows,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ---------- boot ----------

async function start(): Promise<void> {
  await waitForDatabase();
  await ensureSchema();
  app.listen(port, () => console.log('Food Rewards System running on port ' + port));
}

start().catch((error) => {
  console.error('Startup failed:', error);
  process.exit(1);
});
