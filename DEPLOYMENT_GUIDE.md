# 🚀 TCS Clothing Store - Deployment Guide

## Prerequisites
1. GitHub account (already done ✅)
2. MongoDB Atlas account (free tier works)
3. Render account (for backend)
4. Vercel account (for frontend)
5. Razorpay account (for payments)

---

## Step 1: Setup MongoDB Atlas (DATABASE)

1. Go to https://cloud.mongodb.com and sign up/login
2. Click **"Build a Database"** → Select **M0 FREE** tier
3. Choose any cloud provider (AWS recommended) and region close to you
4. Set **Database Access**:
   - Click "Database Access" → "Add New Database User"
   - Create username and password (SAVE THESE!)
   - Set privileges: "Read and write to any database"
5. Set **Network Access**:
   - Click "Network Access" → "Add IP Address"
   - Click **"Allow Access from Anywhere"** (0.0.0.0/0)
6. Get **Connection String**:
   - Go to "Deployment" → Click "Connect" on your cluster
   - Select "Connect your application"
   - Copy the connection string:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/tcs_store?retryWrites=true&w=majority
   ```
   - Replace `<password>` with your actual password

---

## Step 2: Deploy Backend to Render

1. Go to https://render.com and sign up with GitHub
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo: `PavaniPriya06/COLTH_A`
4. Configure:
   - **Name**: `tcs-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add **Environment Variables** (click "Advanced"):

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | `mongodb+srv://...` (your Atlas connection string) |
   | `JWT_SECRET` | `your_secure_random_string_32_chars_min` |
   | `CLIENT_URL` | (leave blank for now, add after Vercel deploy) |
   | `ADMIN_EMAIL` | `admin@tcs.com` |
   | `ADMIN_PASSWORD` | `YourSecurePassword123!` |
   | `RAZORPAY_KEY_ID` | `rzp_live_xxxx` or `rzp_test_xxxx` |
   | `RAZORPAY_KEY_SECRET` | Your Razorpay secret |

6. Click **"Create Web Service"**
7. Wait for deployment (2-5 mins)
8. Copy your backend URL: `https://tcs-backend.onrender.com`

---

## Step 3: Deploy Frontend to Vercel

1. Go to https://vercel.com and sign up with GitHub
2. Click **"Add New..."** → **"Project"**
3. Import your repo: `PavaniPriya06/COLTH_A`
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
5. Add **Environment Variable**:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://tcs-backend.onrender.com` |

6. Click **"Deploy"**
7. Copy your frontend URL: `https://colth-a.vercel.app`

---

## Step 4: Update Backend CORS

Go back to Render Dashboard:
1. Click on your backend service
2. Go to **Environment** tab
3. Update `CLIENT_URL` to your Vercel URL:
   ```
   CLIENT_URL=https://colth-a.vercel.app
   ```
4. Click **Save Changes** (backend will redeploy)

---

## Step 5: Verify Deployment

1. Open your Vercel frontend URL
2. Try to register/login
3. Add products (admin panel)
4. Test checkout flow

---

## 🔧 Troubleshooting

### Database not connecting?
- Check MongoDB Atlas Network Access allows `0.0.0.0/0`
- Verify MONGODB_URI has correct password (no `<` or `>`)
- Check Render logs for connection errors

### CORS errors?
- Ensure CLIENT_URL in Render matches your Vercel URL exactly
- Include `https://` in the URL

### Admin login not working?
- Check ADMIN_EMAIL and ADMIN_PASSWORD in Render env vars
- Default: `admin@tcs.com` / `Admin@123`

### Payments not working?
- Verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
- For testing, use `rzp_test_` keys
- For production, use `rzp_live_` keys

---

## 📱 Mobile Payment Notes

For UPI payments on mobile:
- Razorpay will open GPay/PhonePe/Paytm apps
- After payment, user returns to the app via callback URL
- Ensure these routes work: `/payment-callback/:orderId`

---

## 🔗 Your Links

| Service | URL |
|---------|-----|
| GitHub | https://github.com/PavaniPriya06/COLTH_A |
| Backend (Render) | https://your-app.onrender.com |
| Frontend (Vercel) | https://your-app.vercel.app |
| MongoDB Atlas | https://cloud.mongodb.com |
