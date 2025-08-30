# DESIGNSNACK Lead Generator

A Vue.js frontend with Node.js backend that scrapes jobs.ch to find potential design leads for your UX/UI design subscription business.

## Features

- 🔍 **Smart Job Search**: Search jobs.ch with any term
- 🎯 **Lead Scoring**: Automatic hotness rating (🔥 Hot, 🟡 Warm, 🧊 Cold)
- 📄 **Pagination Support**: Gets all available jobs across multiple pages
- ⚡ **Real-time Updates**: Live loading progress and results
- 📱 **Responsive Design**: Works on desktop and mobile

## Hotness Scoring System

- **🔥 HOT (8+ points)**: Perfect leads - UX/UI Designer roles, contractor positions
- **🟡 WARM (4-7 points)**: Good leads - Frontend/Product roles, small companies
- **🧊 COLD (0-3 points)**: Lower priority - Non-design roles, large corporations

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start both frontend and backend:**
   ```bash
   npm start
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Alternative Commands

- **Frontend only:** `npm run dev`
- **Backend only:** `npm run server`
- **Build for production:** `npm run build`

## How It Works

1. Enter a search term (e.g., "ux designer", "ui developer")
2. The backend scraper navigates jobs.ch and extracts all job listings
3. Each job is scored based on its relevance to design subscription services
4. Results are displayed sorted by hotness score

## API Endpoints

- `POST /api/search` - Search for jobs
- `GET /api/health` - Health check

## Tech Stack

- **Frontend**: Vue.js 3, Tailwind CSS, Vite
- **Backend**: Node.js, Express, Puppeteer
- **Scraping**: Puppeteer with smart pagination handling