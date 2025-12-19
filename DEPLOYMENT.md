# 🚀 Deployment Guide

Since this is a full-stack application with a **Persistent Game Server** (Node.js) and a **Frontend** (React), the best way to deploy is to split them between specialized hosts.

**Recommendation:**
-   **Frontend**: Vercel (Fast, easy React hosting)
-   **Backend**: Render or Railway (Supports persistent Node.js servers, free tiers available)

---

## Part 1: Deploy Backend (Render)

1.  Push your code to **GitHub** (you already did this!).
2.  Sign up at [Render.com](https://render.com).
3.  Click **"New +"** -> **"Web Service"**.
4.  Connect your GitHub repository.
5.  **Settings**:
    -   **Root Directory**: `server`
    -   **Build Command**: `npm install`
    -   **Start Command**: `node index.js`
6.  Click **Deploy**.
7.  Once live, copy your Backend URL (e.g., `https://rummy-royale-server.onrender.com`).

---

## Part 2: Deploy Frontend (Vercel)

1.  Sign up at [Vercel.com](https://vercel.com).
2.  Click **"Add New..."** -> **"Project"**.
3.  Import your GitHub repository.
4.  **Configuration**:
    -   **Root Directory**: `client` (Click "Edit" next to Root Directory and select `client`).
    -   **Framework**: Vite (should be auto-detected).
5.  **Environment Variables** (This connects your game to the server!):
    -   Name: `VITE_API_URL`
    -   Value: `Your_Render_Backend_URL_From_Part_1` (e.g., `https://rummy-royale-server.onrender.com/api`)
    -   *Make sure to include `/api` at the end if your logic expects it, or just the base URL depending on your code. In our code, we append `/room/create` to `API_URL`, so set it to: `https://rummy-royale-server.onrender.com/api`*
6.  Click **Deploy**.

---

## Part 3: Connect Them (Final Step)

1.  Go back to **Render** (Backend) Dashboard.
2.  Go to "Environment" settings.
3.  Add Variable:
    -   `CLIENT_URL`: `https://your-vercel-project.vercel.app` (This allows your Vercel app to talk to the server securely).
4.  Redeploy Server.

**Enjoy your game online!**
