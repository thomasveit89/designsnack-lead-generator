import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import JobsChScraper from './scraper.js';
import { saveSearchResults, getSearchHistory, getSearchById } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from dist directory in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// API route for job search
app.post('/api/search', async (req, res) => {
    try {
        const { searchTerm } = req.body;
        
        if (!searchTerm || !searchTerm.trim()) {
            return res.status(400).json({ error: 'Search term is required' });
        }
        
        console.log(`API: Starting search for "${searchTerm}"`);
        const startTime = Date.now();
        
        const scraper = new JobsChScraper();
        await scraper.init();
        
        try {
            // Scrape jobs with pagination support
            const jobs = await scraper.scrapeJobs(searchTerm.trim(), 10); // Allow up to 10 pages
            
            console.log(`API: Found ${jobs.length} jobs for "${searchTerm}"`);
            
            // Save results to JSON storage
            const searchDuration = Date.now() - startTime;
            const searchId = await saveSearchResults(searchTerm.trim(), jobs, { searchDuration });
            
            console.log(`API: Saved search results to ${searchId}`);
            
            // Return results
            res.json({
                searchId,
                searchTerm: searchTerm.trim(),
                totalJobs: jobs.length,
                scrapedAt: new Date().toISOString(),
                jobs: jobs
            });
            
        } finally {
            await scraper.close();
        }
        
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ 
            error: 'Failed to search jobs', 
            details: error.message 
        });
    }
});

// Get search history
app.get('/api/search-history', async (req, res) => {
    try {
        const history = await getSearchHistory();
        res.json(history);
    } catch (error) {
        console.error('Error fetching search history:', error);
        res.status(500).json({ error: 'Failed to fetch search history' });
    }
});

// Get specific search results by ID
app.get('/api/search/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const searchData = await getSearchById(id);
        res.json(searchData);
    } catch (error) {
        console.error('Error fetching search:', error);
        res.status(404).json({ error: 'Search not found' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(port, () => {
    console.log(`🚀 DESIGNSNACK Lead Generator API running on http://localhost:${port}`);
    console.log(`📊 Frontend will be available on http://localhost:3000`);
    console.log(`🔍 API endpoint: POST http://localhost:${port}/api/search`);
});