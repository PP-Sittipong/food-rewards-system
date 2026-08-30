# 🚀 Railway Deployment Guide

## สำหรับ: sittipong.wwong@gmail.com
## GitHub: PP.Sittipong

---

## ✅ Step 1: สมัคร GitHub & Railway (ถ้ายังไม่มี)

### GitHub:
```
1. ไป github.com
2. Sign up ด้วย Gmail: sittipong.wwong@gmail.com
3. Username: PP.Sittipong
4. Verify email
```

### Railway:
```
1. ไป railway.app
2. "Sign up with GitHub"
3. Authorize Railway
4. Create organization
```

---

## 📝 Step 2: สร้าง GitHub Repository

### ใช้ GitHub Web:
```
1. ไป github.com/new
2. Repository name: food-rewards-system
3. Public repository
4. Create repository
```

### หรือใช้ Command line:
```bash
# ถ้า git ติดตั้งไว้แล้ว
git clone https://github.com/PP.Sittipong/food-rewards-system.git
cd food-rewards-system
```

---

## 🔄 Step 3: Push Code ไป GitHub

ผมจะให้ code แบบพร้อมใช้ ให้คุณทำดังนี้:

```bash
# 1. ดาวน์โหลด files ที่ผมสร้าง
# (ผมจะให้ลิงก์ download)

# 2. Extract ไปที่ folder
tar -xzf railway-code.tar.gz
cd food-rewards-system

# 3. Initialize git
git init
git add .
git commit -m "Initial commit"

# 4. Add remote
git remote add origin https://github.com/PP.Sittipong/food-rewards-system.git

# 5. Push ขึ้น GitHub
git branch -M main
git push -u origin main
```

---

## 🚂 Step 4: Connect Railway ↔ GitHub

### ใน Railway Dashboard:
```
1. ไป railway.app/dashboard
2. Click "New Project"
3. "Deploy from GitHub"
4. Authorize GitHub
5. เลือก: food-rewards-system repository
6. Click "Deploy Now"
```

### Railway จะ Auto:
```
✅ Clone code จาก GitHub
✅ สร้าง PostgreSQL database
✅ ติดตั้ง dependencies (npm install)
✅ Build code (npm run build)
✅ Deploy ให้
✅ ให้ URL
```

---

## 📊 Step 5: Setup Database

### Railway Dashboard:
```
1. ไป Project → Resources
2. เห็น Postgres plugin แล้ว
3. Click "PostgreSQL"
4. DATABASE_URL ถูก auto-set แล้ว
```

### Run Migrations:
```bash
# ใน Railway CLI หรือ dashboard
npm run db:migrate

# (Railway ทำให้อัตโนมัติ)
```

---

## ✨ Step 6: ได้ API URL

Railway จะให้ URL แบบนี้:
```
https://food-rewards-system-production.up.railway.app
```

### ทดสอบ API:
```bash
curl https://food-rewards-system-production.up.railway.app/health

# Response:
# {"status":"ok","timestamp":"..."}
```

---

## 🧪 Step 7: ทดสอบ Endpoints

### ลงทะเบียน:
```bash
curl -X POST https://your-railway-url/api/v1/register \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"087-123-4567","name":"Test"}'
```

### บันทึกการซื้อ:
```bash
curl -X POST https://your-railway-url/api/v1/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number":"087-123-4567",
    "menu_selected":"ไก่ทอด",
    "location_id":"store_001"
  }'
```

### ดูข้อมูลลูกค้า:
```bash
curl https://your-railway-url/api/v1/customer/087-123-4567
```

---

## 📋 Environment Variables (Auto-set)

Railway ตั้งให้แล้ว:
```
✅ NODE_ENV=production
✅ PORT=3000
✅ DATABASE_URL=postgresql://...
✅ LOG_LEVEL=info
```

---

## 📊 Monitor ใน Railway

### ดูแล้ว:
```
1. ไป railway.app/dashboard
2. เลือก Project: food-rewards-system
3. ดูการทำงาน
4. Logs ทั้งหมด
5. Database usage
```

---

## 🔄 Update Code (อนาคต)

ถ้าต้อง update:

```bash
# 1. แก้ไข code
vim src/handlers/transaction.ts

# 2. Push ไป GitHub
git add .
git commit -m "Update transaction logic"
git push origin main

# 3. Railway auto-deploy
# (ไม่ต้องทำอะไร Railway ทำให้เอง)
```

---

## ⚙️ Troubleshooting

### Deployment Failed?
```
1. ไป Railway Dashboard
2. ดู Logs
3. ตรวจ package.json
4. ตรวจ database connection
```

### Database Error?
```
1. Verify DATABASE_URL ตั้งแล้ว
2. Run migrations: npm run db:migrate
3. Check Railway PostgreSQL status
```

### API Not Responding?
```
1. Check Server status ใน Railway
2. ดู Logs
3. Test health: /health endpoint
```

---

## 📝 Monitoring Setup

Railway ให้ monitoring:
```
✅ Response time
✅ Error rate
✅ Database connections
✅ CPU/Memory usage
✅ Logs ทั้งหมด
```

---

## 🎉 Done!

เสร็จแล้ว! 🚀

ได้ API URL ที่:
```
https://food-rewards-system-production.up.railway.app
```

ใช้ได้เลยเลย! ✅

---

## 📞 ถ้ามีปัญหา

บอกผม:
1. Error message
2. Railway Logs
3. ขั้นไหนติด

ผมช่วยแก้ให้! 😊
