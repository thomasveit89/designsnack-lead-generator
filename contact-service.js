// Contact discovery service using Google Search API + Hunter.io
import { saveContactsToCache, getCachedContacts } from './storage.js';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
const HUNTER_API_KEY = process.env.HUNTER_API_KEY;

// Find company domain using Google Search API
export async function findCompanyDomain(companyName) {
  try {
    console.log(`Searching for domain of: ${companyName}`);
    
    // Clean up company name for search
    const cleanCompanyName = companyName
      .replace(/\b(AG|GmbH|Ltd|Inc|Corp|LLC|SA)\b/gi, '')
      .trim();
    
    // Try multiple search strategies
    const searchQueries = [
      `"${cleanCompanyName}" official website`,
      `${cleanCompanyName} company website`,
      `${cleanCompanyName} careers jobs`
    ];
    
    for (const query of searchQueries) {
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`;
      
      const response = await fetch(searchUrl);
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        // Extract domain from the first few results
        for (const item of data.items.slice(0, 3)) {
          const url = new URL(item.link);
          const domain = url.hostname.replace('www.', '');
          
          // Skip common sites that aren't company domains
          if (!domain.includes('linkedin.com') && 
              !domain.includes('facebook.com') && 
              !domain.includes('wikipedia.org') &&
              !domain.includes('jobs.ch') &&
              !domain.includes('indeed.com')) {
            console.log(`Found domain: ${domain}`);
            return domain;
          }
        }
      }
    }
    
    // Fallback: try to guess domain from company name
    const guessedDomain = guessCompanyDomain(cleanCompanyName);
    console.log(`Fallback guess: ${guessedDomain}`);
    return guessedDomain;
    
  } catch (error) {
    console.error('Error finding company domain:', error);
    // Fallback to guessed domain
    return guessCompanyDomain(companyName);
  }
}

// Fallback domain guessing
function guessCompanyDomain(companyName) {
  const cleanName = companyName
    .toLowerCase()
    .replace(/\b(ag|gmbh|ltd|inc|corp|llc|sa|schweiz|switzerland)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  
  // Common Swiss/German company domain patterns
  const possibleDomains = [
    `${cleanName}.ch`,
    `${cleanName}.com`,
    `${cleanName}.de`
  ];
  
  return possibleDomains[0]; // Return first guess
}

// Find contacts using Hunter.io
export async function findCompanyContacts(domain, searchTerm = '') {
  try {
    console.log(`Finding contacts for domain: ${domain}`);
    
    const hunterUrl = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}&limit=10`;
    
    const response = await fetch(hunterUrl);
    if (!response.ok) {
      throw new Error(`Hunter.io API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.data || !data.data.emails) {
      return { contacts: [], domain, confidence: 'low' };
    }
    
    // Process and rank contacts
    const contacts = data.data.emails
      .filter(email => email.verification && email.verification.result !== 'undeliverable')
      .map(email => ({
        email: email.value,
        firstName: email.first_name,
        lastName: email.last_name,
        position: email.position,
        department: email.department,
        confidence: email.verification ? email.verification.result : 'unknown',
        score: calculateContactScore(email, searchTerm)
      }))
      .sort((a, b) => b.score - a.score);
    
    return {
      contacts: contacts.slice(0, 8), // Limit to top 8 contacts
      domain,
      confidence: contacts.length > 0 ? 'high' : 'low',
      totalFound: data.data.emails.length
    };
    
  } catch (error) {
    console.error('Error finding contacts:', error);
    return { 
      contacts: [], 
      domain, 
      confidence: 'low', 
      error: error.message 
    };
  }
}

// Score contacts based on relevance to search term and role importance
function calculateContactScore(contact, searchTerm = '') {
  let score = 0;
  const position = (contact.position || '').toLowerCase();
  const department = (contact.department || '').toLowerCase();
  const searchLower = searchTerm.toLowerCase();
  
  // Role-based scoring
  if (position.includes('ceo') || position.includes('founder') || position.includes('president')) {
    score += 8;
  } else if (position.includes('hr') || position.includes('human resources') || position.includes('recruitment') || position.includes('talent')) {
    score += 7;
  } else if (position.includes('head') || position.includes('director') || position.includes('vp') || position.includes('chief')) {
    score += 6;
  } else if (position.includes('manager') || position.includes('lead')) {
    score += 5;
  }
  
  // Search term relevance scoring
  if (searchLower.includes('design') || searchLower.includes('ux') || searchLower.includes('ui')) {
    if (position.includes('design') || position.includes('ux') || position.includes('ui') || position.includes('creative')) {
      score += 10; // High bonus for design-related searches
    }
  }
  
  if (searchLower.includes('developer') || searchLower.includes('engineer')) {
    if (position.includes('tech') || position.includes('engineering') || position.includes('developer') || position.includes('cto')) {
      score += 8;
    }
  }
  
  if (searchLower.includes('marketing')) {
    if (position.includes('marketing') || position.includes('brand') || position.includes('communication')) {
      score += 8;
    }
  }
  
  // Department bonuses
  if (department.includes('design') || department.includes('creative') || department.includes('product')) {
    score += 3;
  }
  
  if (department.includes('hr') || department.includes('people')) {
    score += 2;
  }
  
  // Verification confidence bonus
  if (contact.confidence === 'high') {
    score += 2;
  } else if (contact.confidence === 'medium') {
    score += 1;
  }
  
  return score;
}

// Main function to find contacts for a job
export async function findJobContacts(job, searchTerm) {
  console.log(`Finding contacts for job at: ${job.company}`);
  
  try {
    // Step 1: Find company domain
    const domain = await findCompanyDomain(job.company);
    
    // Step 2: Check cache first
    console.log(`Checking cache for ${job.company} (${domain})`);
    const cachedResults = await getCachedContacts(job.company, domain);
    
    if (cachedResults) {
      console.log(`✅ Using cached contacts for ${job.company}`);
      return {
        ...cachedResults,
        company: job.company,
        jobTitle: job.title,
        searchTerm,
        cached: true
      };
    }
    
    // Step 3: No cache found, fetch from APIs
    console.log(`💰 Making API calls for ${job.company} (not cached)`);
    const contactResults = await findCompanyContacts(domain, searchTerm);
    
    // Step 4: Cache the results for future use
    if (contactResults.contacts.length > 0) {
      await saveContactsToCache(job.company, domain, contactResults, searchTerm);
    }
    
    return {
      ...contactResults,
      company: job.company,
      jobTitle: job.title,
      searchTerm,
      cached: false
    };
    
  } catch (error) {
    console.error('Error in findJobContacts:', error);
    return {
      contacts: [],
      company: job.company,
      domain: null,
      confidence: 'low',
      error: error.message,
      cached: false
    };
  }
}