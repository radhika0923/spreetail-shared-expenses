# Step-by-Step Deployment Guide

To deploy this application publicly, we will use **Render** for your Node.js/SQLite backend and **Vercel** for your React frontend. These are the industry standards for free, seamless deployments.

> [!WARNING]
> SQLite is a local file-based database (`expenses.db`). Because Render's free tier uses ephemeral storage (it spins down after 15 minutes of inactivity), your database will reset to its initial state every time the server spins down. For a portfolio/assignment piece, this is usually acceptable, but it's important to know!

---

## Part 1: Deploying the Backend to Render

1. **Commit and Push**: Ensure your latest code is pushed to your GitHub repository.
2. Go to **[Render.com](https://render.com/)** and log in with GitHub.
3. Click **"New +"** in the top right and select **Web Service**.
4. Choose **"Build and deploy from a Git repository"** and click **Next**.
5. Connect your GitHub account and select your `expense app` repository.
6. Configure the Web Service:
   - **Name**: `expense-backend`
   - **Root Directory**: `server` *(Important! Since your backend is in the `server` folder)*
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
7. Click **Create Web Service**.
8. Wait a few minutes for the build to finish. Once it says "Live", copy the **URL** (e.g., `https://expense-backend-xxx.onrender.com`). You will need this for the frontend!

---

## Part 2: Deploying the Frontend to Vercel

1. Go to **[Vercel.com](https://vercel.com/)** and log in with GitHub.
2. Click **"Add New..."** -> **"Project"**.
3. Import your `expense app` repository from GitHub.
4. Configure the Project:
   - **Project Name**: `expense-dashboard`
   - **Framework Preset**: `Vite` *(Vercel usually auto-detects this)*
   - **Root Directory**: Click "Edit" and select `client` *(Important! Since your React app is in the `client` folder)*.
5. Open the **Environment Variables** dropdown.
   - **Name**: `VITE_API_URL`
   - **Value**: Paste the URL you copied from Render in Part 1 (e.g., `https://expense-backend-xxx.onrender.com`). Make sure there is NO trailing slash (`/`) at the end of the URL.
   - Click **Add**.
6. Click **Deploy**.
7. Wait 1-2 minutes for Vercel to build your React app.

## You are Live!
Once Vercel finishes, it will give you a public URL (e.g., `https://expense-dashboard.vercel.app`). Click it, and you will see your fully functional, public Shared Expenses Application!
