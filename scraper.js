import puppeteer from 'puppeteer';
import fs from 'fs';

class JobsChScraper {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async init() {
        try {
            this.browser = await puppeteer.launch({
                headless: false, // Set to true for production
                defaultViewport: null,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            this.page = await this.browser.newPage();

            // Set user agent to avoid bot detection
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

            // Wait for network to be idle
            await this.page.setDefaultNavigationTimeout(30000);
        } catch (error) {
            console.error('Failed to initialize browser:', error);
            if (this.browser) {
                await this.browser.close();
            }
            throw error;
        }
    }

    async scrapeJobs(searchTerm = 'ux designer', maxPages = 5) {
        try {
            const allJobs = [];
            let currentPage = 1;

            while (currentPage <= maxPages) {
                console.log(`Scraping page ${currentPage}...`);

                try {
                    // Navigate to the jobs page
                    const url = `https://www.jobs.ch/en/vacancies/?term=${encodeURIComponent(searchTerm)}&page=${currentPage}`;
                    console.log(`Navigating to: ${url}`);
                    
                    const response = await this.page.goto(url, { waitUntil: 'networkidle2' });
                    console.log(`Page response status: ${response.status()}`);

                    // Wait for job listings to load with a more reliable method
                    await this.page.waitForSelector('body', { timeout: 10000 });
                    
                    // Handle cookie consent and modals
                    try {
                        // Wait a moment for modals to appear
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        console.log('Attempting to close modals...');
                        
                        // Close cookie consent first
                        await this.page.evaluate(() => {
                            const okButton = Array.from(document.querySelectorAll('button')).find(btn => 
                                btn.textContent.trim().toLowerCase() === 'ok'
                            );
                            if (okButton) {
                                console.log('Clicking OK button');
                                okButton.click();
                                return true;
                            }
                            return false;
                        });
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Close Smart Search modal by X button or Close text
                        await this.page.evaluate(() => {
                            const closeButton = Array.from(document.querySelectorAll('button')).find(btn => 
                                btn.textContent.trim().toLowerCase() === 'close'
                            );
                            if (closeButton) {
                                console.log('Clicking Close button');
                                closeButton.click();
                                return true;
                            }
                            
                            // Try clicking X button
                            const xButton = document.querySelector('button[aria-label*="close" i], button[data-testid="close"]');
                            if (xButton) {
                                console.log('Clicking X button');
                                xButton.click();
                                return true;
                            }
                            
                            return false;
                        });
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Try pressing ESC key to close modals
                        await this.page.keyboard.press('Escape');
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                    } catch (modalError) {
                        console.log('Modal handling error (continuing):', modalError.message);
                    }
                    
                    // Take a screenshot for debugging
                    await this.page.screenshot({ path: `debug_page_${currentPage}.png`, fullPage: false });
                    
                    // Add extra wait time to ensure page is fully loaded
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    // Check if there are job listings on this page
                    const jobsOnPage = await this.extractJobsFromPage();

                    if (jobsOnPage.length === 0) {
                        console.log(`No more jobs found on page ${currentPage}. Stopping.`);
                        break;
                    }

                    allJobs.push(...jobsOnPage);
                    console.log(`Found ${jobsOnPage.length} jobs on page ${currentPage}. Total so far: ${allJobs.length}`);

                    // Check if there's a next page before incrementing
                    const hasNextPage = await this.page.evaluate(() => {
                        const nextButton = Array.from(document.querySelectorAll('a')).find(link => 
                            link.textContent.toLowerCase().trim() === 'next' ||
                            link.getAttribute('aria-label')?.toLowerCase().includes('next')
                        );
                        return !!nextButton;
                    });

                    if (!hasNextPage && currentPage >= maxPages) {
                        console.log(`Reached max pages (${maxPages}) and no next page available. Stopping.`);
                        break;
                    } else if (!hasNextPage) {
                        console.log(`No next page available. Stopping after page ${currentPage}.`);
                        break;
                    }

                    currentPage++;

                    // Add delay between requests to be respectful
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (pageError) {
                    console.error(`Error on page ${currentPage}:`, pageError);
                    currentPage++;
                    continue;
                }
            }

            return allJobs;
        } catch (error) {
            console.error('Error scraping jobs:', error);
            await this.close(); // Cleanup on error
            throw error;
        }
    }

    async extractJobsFromPage() {
        // First try to find job elements using our debug approach
        const debugInfo = await this.page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const jobElements = elements.filter(el => {
                const text = el.textContent?.toLowerCase() || '';
                return text.includes('easy apply') && text.length < 1000;
            });
            
            // Also look for other job patterns
            const jobLinks = document.querySelectorAll('a[href*="/vacancies/detail/"]');
            const jobCards = document.querySelectorAll('[class*="card"], [class*="item"], article');
            
            return {
                totalElements: elements.length,
                jobElements: jobElements.length,
                jobLinks: jobLinks.length,
                jobCards: jobCards.length,
                pageTitle: document.title
            };
        });
        
        console.log(`Debug: Found ${debugInfo.jobElements} "Easy apply" elements, ${debugInfo.jobLinks} job links, ${debugInfo.jobCards} potential job cards on: ${debugInfo.pageTitle}`);
        
        // Check if there are more pages available
        const hasNextPage = await this.page.evaluate(() => {
            const nextButton = Array.from(document.querySelectorAll('a')).find(link => 
                link.textContent.toLowerCase().includes('next') ||
                link.getAttribute('aria-label')?.toLowerCase().includes('next')
            );
            return !!nextButton;
        });
        
        if (hasNextPage) {
            console.log('Next page available - pagination detected');
        }
        
        return await this.page.evaluate(() => {
            const jobs = [];

            // Based on the debug results, let's look for job elements with "Easy apply"
            // Filter to get unique job cards (avoid duplicates by checking for job URLs)
            const allElements = Array.from(document.querySelectorAll('*')).filter(el => {
                const text = el.textContent?.toLowerCase() || '';
                return text.includes('easy apply') && text.length > 50 && text.length < 1000;
            });
            
            // Deduplicate by checking for elements that contain job links
            const jobElements = [];
            const seenUrls = new Set();
            
            for (const element of allElements) {
                const linkElement = element.querySelector('a') || (element.tagName.toLowerCase() === 'a' ? element : null);
                const url = linkElement?.href || '';
                
                if (url && url.includes('/vacancies/detail/')) {
                    if (!seenUrls.has(url)) {
                        seenUrls.add(url);
                        jobElements.push(element);
                    }
                } else if (!url) {
                    // Include elements without URLs if they have substantial job info
                    const text = element.textContent || '';
                    if (text.includes('Place of work:') && text.includes('Workload:')) {
                        jobElements.push(element);
                    }
                }
            }

            // If that doesn't work, try to get all job links directly
            if (jobElements.length < 5) { // If we have very few jobs, try alternative approach
                const jobLinks = Array.from(document.querySelectorAll('a[href*="/vacancies/detail/"]'));
                console.log(`Found ${jobLinks.length} direct job links`);
                
                // For each job link, find its parent container that likely has the job info
                jobLinks.forEach(link => {
                    // Look for parent element that contains job information
                    let parent = link.parentElement;
                    while (parent && parent !== document.body) {
                        const text = parent.textContent || '';
                        if (text.includes('Place of work:') || text.includes('Workload:') || text.length > 100) {
                            // Check if we already have this URL
                            const url = link.href;
                            const alreadyExists = jobElements.some(el => {
                                const existingLink = el.querySelector('a') || el;
                                return existingLink.href === url;
                            });
                            
                            if (!alreadyExists) {
                                jobElements.push(parent);
                            }
                            break;
                        }
                        parent = parent.parentElement;
                    }
                });
                
                console.log(`Total job elements after adding link parents: ${jobElements.length}`);
            }

            jobElements.forEach((element, index) => {
                try {
                    const text = element.textContent || '';
                    
                    // Parse the job information from the text content
                    // Format appears to be: "TimeFrameJob TitlePlace of work:LocationWorkload:XContract type:YCompanyEasy apply"
                    
                    // Extract job URL first
                    const linkElement = element.querySelector('a') || (element.tagName.toLowerCase() === 'a' ? element : null);
                    let jobUrl = '';
                    if (linkElement && linkElement.href) {
                        jobUrl = linkElement.href;
                    }
                    
                    // Split the text to extract different parts and format description
                    const parts = text.split('Easy apply')[0]; // Remove "Easy apply" from the end
                    
                    // Extract published date/time from text
                    const publishedMatch = text.match(/^(Last week|Last month|Last quarter|Last year|Yesterday|\d+\s+(?:days?|weeks?|months?|quarters?)\s+ago|New)/);
                    const publishedDate = publishedMatch ? publishedMatch[1] : '';
                    
                    // Extract location (after "Place of work:")
                    const locationMatch = text.match(/Place of work:\s*([^W]+?)(?=Workload:|$)/);
                    const location = locationMatch ? locationMatch[1].trim() : '';
                    
                    // Extract workload (after "Workload:")
                    const workloadMatch = text.match(/Workload:\s*([^C]+?)(?=Contract type:|$)/);
                    const workload = workloadMatch ? workloadMatch[1].trim() : '';
                    
                    // Extract contract type (after "Contract type:")
                    const contractMatch = text.match(/Contract type:\s*([^A-Z]+?)(?=[A-Z]|$)/);
                    const contractType = contractMatch ? contractMatch[1].trim() : '';
                    
                    // Extract company - look for company name after contract type or before "Easy apply"
                    let company = '';
                    
                    // Try to find company after contract type but before any potential next field
                    if (contractType) {
                        const afterContractText = text.split(`Contract type:${contractType}`)[1];
                        if (afterContractText) {
                            const companyMatch = afterContractText.match(/([A-Z][A-Za-z\s&\.\-,]+?)(?=Easy apply|Recommended|$)/);
                            if (companyMatch) {
                                company = companyMatch[1].trim();
                                // Clean up company name - remove contract type if it's stuck to company name
                                company = company.replace(/^(Unlimited employment|Limited|Permanent|Contract|Temporary)\s*/, '').trim();
                            }
                        }
                    }
                    
                    // Fallback: look for company pattern before "Easy apply"
                    if (!company) {
                        const beforeEasyApply = text.split('Easy apply')[0];
                        const companyMatch = beforeEasyApply.match(/([A-Z][A-Za-z\s&\.\-,]{3,50}?)(?=Easy apply|Recommended|$)/);
                        if (companyMatch) {
                            company = companyMatch[1].trim();
                            // Clean up company name
                            company = company.replace(/^(Unlimited employment|Limited|Permanent|Contract|Temporary)\s*/, '').trim();
                        }
                    }
                    
                    // Extract title - remove time indicators from the beginning
                    const titleMatch = text.match(/^(?:Last week|Last month|Last quarter|Last year|Yesterday|\d+\s+(?:days?|weeks?|months?|quarters?)\s+ago|New)?\s*(.+?)(?=Place of work:|$)/);
                    let title = '';
                    if (titleMatch) {
                        title = titleMatch[1].trim();
                    } else {
                        // Fallback: get text before "Place of work:"
                        const beforeLocation = text.split('Place of work:')[0];
                        title = beforeLocation.replace(/^(?:Last week|Last month|Last quarter|Last year|Yesterday|\d+\s+(?:days?|weeks?|months?)\s+ago|New)\s*/, '').trim();
                    }
                    
                    // Clean up title - remove any leading dashes or extra whitespace
                    title = title.replace(/^\s*[-–]\s*/, '').trim();
                    
                    // Create a cleaner, structured description
                    const descriptionParts = [];
                    if (publishedDate) descriptionParts.push(publishedDate);
                    if (location) descriptionParts.push(`📍 ${location}`);
                    if (workload) descriptionParts.push(`⏰ ${workload}`);
                    if (contractType) descriptionParts.push(`📋 ${contractType}`);
                    if (company) descriptionParts.push(`🏢 ${company}`);
                    
                    const formattedDescription = descriptionParts.join(' • ');

                    // Only add job if we have meaningful data
                    if (title && title.length > 0 && title.length < 200) {
                        jobs.push({
                            id: `job_${index + 1}`,
                            title: title,
                            company: company,
                            location: location,
                            workload: workload,
                            contractType: contractType,
                            salary: '', // Not easily extractable from this format
                            publishedDate: publishedDate,
                            description: formattedDescription.substring(0, 300),
                            url: jobUrl,
                            scrapedAt: new Date().toISOString()
                        });
                    }
                } catch (error) {
                    // Silent error handling to avoid spam
                }
            });

            return jobs;
        });
    }

    async getJobDetails(jobUrl) {
        let detailPage = null;
        try {
            detailPage = await this.browser.newPage();
            await detailPage.goto(jobUrl, { waitUntil: 'networkidle2' });

            const details = await detailPage.evaluate(() => {
                // Extract detailed job information
                const getTextContent = (selector) => {
                    const element = document.querySelector(selector);
                    return element ? element.textContent.trim() : '';
                };

                return {
                    fullDescription: getTextContent('.job-description, .description, [class*="description"]'),
                    requirements: getTextContent('.requirements, [class*="requirement"]'),
                    benefits: getTextContent('.benefits, [class*="benefit"]'),
                    companyInfo: getTextContent('.company-info, [class*="company-info"]'),
                    contactInfo: getTextContent('.contact, [class*="contact"]'),
                    applicationDeadline: getTextContent('[class*="deadline"], [class*="apply-by"]')
                };
            });

            return details;
        } catch (error) {
            console.error(`Error getting job details for ${jobUrl}:`, error);
            return null;
        } finally {
            if (detailPage) {
                await detailPage.close();
            }
        }
    }

    async saveToJson(jobs, filename = 'jobs_ch_ux_designer.json', searchTerm = 'ux designer') {
        try {
            const data = {
                searchTerm: searchTerm,
                totalJobs: jobs.length,
                scrapedAt: new Date().toISOString(),
                jobs: jobs
            };

            fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
            console.log(`Saved ${jobs.length} jobs to ${filename}`);
        } catch (error) {
            console.error('Error saving to JSON:', error);
        }
    }

    async saveToCsv(jobs, filename = 'jobs_ch_ux_designer.csv') {
        try {
            if (jobs.length === 0) return;

            const headers = Object.keys(jobs[0]);
            const csvContent = [
                headers.join(','),
                ...jobs.map(job =>
                    headers.map(header => {
                        const value = job[header] || '';
                        // Escape quotes and wrap in quotes if contains comma
                        return value.includes(',') || value.includes('"') ?
                            `"${value.replace(/"/g, '""')}"` : value;
                    }).join(',')
                )
            ].join('\n');

            fs.writeFileSync(filename, csvContent, 'utf8');
            console.log(`Saved ${jobs.length} jobs to ${filename}`);
        } catch (error) {
            console.error('Error saving to CSV:', error);
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Usage example
async function main() {
    const scraper = new JobsChScraper();

    try {
        await scraper.init();

        // Scrape UX designer jobs - increase to 5 pages to get all jobs
        const jobs = await scraper.scrapeJobs('ux designer', 5);

        console.log(`Total jobs scraped: ${jobs.length}`);

        // Optionally get detailed information for each job
        // Warning: This will be slow as it visits each job page
        // for (let i = 0; i < Math.min(jobs.length, 5); i++) {
        //   if (jobs[i].url) {
        //     console.log(`Getting details for job ${i + 1}...`);
        //     const details = await scraper.getJobDetails(jobs[i].url);
        //     if (details) {
        //       jobs[i] = { ...jobs[i], ...details };
        //     }
        //     // Add delay between requests
        //     await new Promise(resolve => setTimeout(resolve, 2000));
        //   }
        // }

        // Save results
        await scraper.saveToJson(jobs, 'jobs_ch_ux_designer.json', 'ux designer');
        await scraper.saveToCsv(jobs);

        // Display first few jobs
        console.log('\nFirst few jobs:');
        jobs.slice(0, 3).forEach((job, index) => {
            console.log(`\n${index + 1}. ${job.title}`);
            console.log(`   Company: ${job.company}`);
            console.log(`   Location: ${job.location}`);
            console.log(`   Workload: ${job.workload}`);
            console.log(`   URL: ${job.url}`);
        });

    } catch (error) {
        console.error('Scraping failed:', error);
    } finally {
        await scraper.close();
    }
}

// Export for use as module
export default JobsChScraper;

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
    main();
}