import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = './data';
const SEARCHES_DIR = './data/searches';
const HISTORY_FILE = './data/search-history.json';

// Ensure data directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(SEARCHES_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error);
  }
}

// Generate unique search ID
function generateSearchId(searchTerm) {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const time = timestamp.split('T')[1].split('.')[0].replace(/:/g, '-');
  const cleanTerm = searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${date}_${cleanTerm}_${time}`;
}

// Save search results to JSON file
export async function saveSearchResults(searchTerm, jobs, metadata = {}) {
  await ensureDirectories();
  
  const searchId = generateSearchId(searchTerm);
  const timestamp = new Date().toISOString();
  
  const searchData = {
    id: searchId,
    searchTerm,
    timestamp,
    totalResults: jobs.length,
    jobs,
    metadata: {
      searchDuration: metadata.searchDuration || null,
      hotnessStats: calculateHotnessStats(jobs),
      ...metadata
    }
  };
  
  // Save individual search file
  const searchFile = path.join(SEARCHES_DIR, `${searchId}.json`);
  await fs.writeFile(searchFile, JSON.stringify(searchData, null, 2));
  
  // Update search history index
  await updateSearchHistory(searchId, searchTerm, timestamp, jobs.length);
  
  return searchId;
}

// Update search history index file
async function updateSearchHistory(searchId, searchTerm, timestamp, resultCount) {
  let history = { searches: [] };
  
  try {
    const existingHistory = await fs.readFile(HISTORY_FILE, 'utf-8');
    history = JSON.parse(existingHistory);
  } catch (error) {
    // File doesn't exist yet, use empty history
  }
  
  const searchEntry = {
    id: searchId,
    searchTerm,
    timestamp,
    resultCount,
    filePath: `searches/${searchId}.json`
  };
  
  // Add to beginning of array (most recent first)
  history.searches.unshift(searchEntry);
  
  // Keep only last 50 searches
  history.searches = history.searches.slice(0, 50);
  
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Get search history
export async function getSearchHistory() {
  try {
    const historyData = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(historyData);
  } catch (error) {
    return { searches: [] };
  }
}

// Get specific search results by ID
export async function getSearchById(searchId) {
  try {
    const searchFile = path.join(SEARCHES_DIR, `${searchId}.json`);
    const searchData = await fs.readFile(searchFile, 'utf-8');
    return JSON.parse(searchData);
  } catch (error) {
    throw new Error(`Search not found: ${searchId}`);
  }
}

// Calculate hotness statistics
function calculateHotnessStats(jobs) {
  const stats = { hot: 0, warm: 0, cold: 0 };
  jobs.forEach(job => {
    if (job.hotnessLevel) {
      stats[job.hotnessLevel]++;
    }
  });
  return stats;
}

// Delete old search files (cleanup utility)
export async function cleanupOldSearches(daysOld = 30) {
  try {
    const files = await fs.readdir(SEARCHES_DIR);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(SEARCHES_DIR, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`Deleted old search file: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up old searches:', error);
  }
}