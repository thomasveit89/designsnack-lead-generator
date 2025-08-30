# DESIGNSNACK Lead Generator

A Vue.js job scraper with AI-powered email generation for finding and reaching out to UX/UI design prospects.

## Features

- **Job Scraping**: Scrapes jobs.ch with pagination support
- **Hotness Scoring**: Ranks leads based on UX/UI design relevance
- **Contact Discovery**: Finds company contacts using Hunter.io and Google Search
- **AI Email Generation**: Creates personalized outreach emails using ChatGPT
- **Smart Caching**: Prevents duplicate API calls with 7-day contact caching
- **Search History**: Saves and reloads previous searches

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory with your API keys:

```env
# Required API Keys
OPENAI_API_KEY=your_openai_api_key_here
HUNTER_API_KEY=your_hunter_io_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_google_custom_search_id_here
```

### 3. API Key Setup

**OpenAI API**: Get your key from [OpenAI Platform](https://platform.openai.com/api-keys)

**Hunter.io API**: Get your key from [Hunter.io API](https://hunter.io/api)

**Google Search API**: 
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Custom Search JSON API
3. Create credentials (API key)
4. Set up a Custom Search Engine at [Google CSE](https://cse.google.com/)

### 4. Run the Application

Start the backend server:
```bash
npm run server
```

Start the frontend development server:
```bash
npm run dev
```

Visit `http://localhost:3000` to use the application.

## Usage

1. **Search for Jobs**: Enter search terms like "ux designer" or "ui developer"
2. **Find Contacts**: Click "Find Contact & Draft Email" on any job
3. **Generate Emails**: Click "Draft Email" next to any contact
4. **Copy & Send**: Copy the generated email and send via your email client

## Tech Stack

- **Frontend**: Vue.js 3, Tailwind CSS, Vite
- **Backend**: Node.js, Express.js
- **Scraping**: Puppeteer
- **APIs**: OpenAI GPT-4o-mini, Hunter.io, Google Search
- **Storage**: JSON file system with caching

## Project Structure

```
├── src/
│   ├── App.vue           # Main Vue application
│   ├── main.js          # Vue app entry point
│   └── style.css        # Global styles
├── contact-service.js    # Contact discovery logic
├── email-service.js      # AI email generation
├── scraper.js           # Jobs.ch scraping
├── server.js            # Express API server
├── storage.js           # JSON storage utilities
└── data/
    ├── searches/        # Cached job searches
    └── contacts/        # Cached contact data
```

## API Endpoints

- `POST /api/search` - Search for jobs
- `GET /api/search-history` - Get search history
- `GET /api/search/:id` - Get specific search results
- `POST /api/find-contacts` - Find contacts for a job
- `POST /api/generate-email` - Generate personalized email

## Contributing

This project was built as a lead generation tool for DESIGNSNACK design subscription services.