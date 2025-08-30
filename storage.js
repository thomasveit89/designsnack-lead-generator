import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = './data';
const SEARCHES_DIR = './data/searches';
const CONTACTS_DIR = './data/contacts';
const HISTORY_FILE = './data/search-history.json';
const CONTACTS_CACHE_FILE = './data/contacts-cache.json';

// Ensure data directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(SEARCHES_DIR, { recursive: true });
    await fs.mkdir(CONTACTS_DIR, { recursive: true });
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

// Contact caching functions

// Generate cache key for company contacts
function generateContactCacheKey(company, domain) {
  const cleanCompany = company.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanDomain = domain ? domain.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  return `${cleanCompany}_${cleanDomain}`;
}

// Save contact results to cache
export async function saveContactsToCache(company, domain, contactResults, searchTerm) {
  await ensureDirectories();
  
  try {
    const cacheKey = generateContactCacheKey(company, domain);
    const timestamp = new Date().toISOString();
    
    const cacheData = {
      cacheKey,
      company,
      domain,
      searchTerm,
      timestamp,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      contactResults
    };
    
    // Save individual contact cache file
    const cacheFile = path.join(CONTACTS_DIR, `${cacheKey}.json`);
    await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    
    // Update contacts cache index
    await updateContactsCache(cacheKey, company, domain, timestamp);
    
    console.log(`Cached contacts for ${company} (${domain})`);
    return cacheKey;
    
  } catch (error) {
    console.error('Error saving contacts to cache:', error);
  }
}

// Update contacts cache index
async function updateContactsCache(cacheKey, company, domain, timestamp) {
  let cache = { entries: [] };
  
  try {
    const existingCache = await fs.readFile(CONTACTS_CACHE_FILE, 'utf-8');
    cache = JSON.parse(existingCache);
  } catch (error) {
    // File doesn't exist yet, use empty cache
  }
  
  const cacheEntry = {
    cacheKey,
    company,
    domain,
    timestamp,
    filePath: `contacts/${cacheKey}.json`
  };
  
  // Remove existing entry for same company/domain if it exists
  cache.entries = cache.entries.filter(entry => entry.cacheKey !== cacheKey);
  
  // Add new entry at beginning
  cache.entries.unshift(cacheEntry);
  
  // Keep only last 100 entries
  cache.entries = cache.entries.slice(0, 100);
  
  await fs.writeFile(CONTACTS_CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Get cached contact results
export async function getCachedContacts(company, domain) {
  try {
    const cacheKey = generateContactCacheKey(company, domain);
    const cacheFile = path.join(CONTACTS_DIR, `${cacheKey}.json`);
    
    const cacheData = await fs.readFile(cacheFile, 'utf-8');
    const parsed = JSON.parse(cacheData);
    
    // Check if cache has expired
    const now = new Date();
    const expiresAt = new Date(parsed.expiresAt);
    
    if (now > expiresAt) {
      console.log(`Cache expired for ${company}, removing...`);
      await fs.unlink(cacheFile);
      return null;
    }
    
    console.log(`Found cached contacts for ${company} (${domain})`);
    return parsed.contactResults;
    
  } catch (error) {
    // Cache file doesn't exist or is corrupted
    return null;
  }
}

// Clean up expired contact cache files
export async function cleanupExpiredContactCache() {
  try {
    const files = await fs.readdir(CONTACTS_DIR);
    const now = new Date();
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(CONTACTS_DIR, file);
          const cacheData = await fs.readFile(filePath, 'utf-8');
          const parsed = JSON.parse(cacheData);
          
          const expiresAt = new Date(parsed.expiresAt);
          if (now > expiresAt) {
            await fs.unlink(filePath);
            console.log(`Cleaned up expired contact cache: ${file}`);
          }
        } catch (error) {
          // File is corrupted, delete it
          const filePath = path.join(CONTACTS_DIR, file);
          await fs.unlink(filePath);
          console.log(`Deleted corrupted contact cache: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up contact cache:', error);
  }
}