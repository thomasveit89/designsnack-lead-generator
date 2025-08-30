// Email generation service using OpenAI ChatGPT

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Generate personalized email using ChatGPT
export async function generatePersonalizedEmail(job, contact, searchTerm) {
  try {
    console.log(`Generating email for ${contact.firstName} ${contact.lastName} at ${job.company}`);
    
    // Create a detailed prompt for ChatGPT
    const prompt = createEmailPrompt(job, contact, searchTerm);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using the more cost-effective model
        messages: [
          {
            role: 'system',
            content: 'You are a professional business development expert writing personalized outreach emails for DESIGNSNACK, a design subscription service. Write compelling, personalized emails that feel genuine and not salesy.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.status}`);
    }
    
    const data = await response.json();
    const emailContent = data.choices[0].message.content.trim();
    
    return {
      success: true,
      emailContent,
      contact,
      job,
      usage: data.usage
    };
    
  } catch (error) {
    console.error('Error generating email:', error);
    return {
      success: false,
      error: error.message,
      contact,
      job
    };
  }
}

// Create detailed prompt for email generation
function createEmailPrompt(job, contact, searchTerm) {
  const contactName = contact.firstName || 'there';
  const contactTitle = contact.position || 'team member';
  const company = job.company;
  const jobTitle = job.title;
  const jobLocation = job.location || 'your location';
  const jobWorkload = job.workload || '';
  
  return `
Write a personalized cold email for the following scenario:

SENDER (Me):
- Thomas from DESIGNSNACK
- Offering design subscription services (UX/UI design)
- Professional, friendly, direct approach
- Focus on helping companies scale their design needs

RECIPIENT:
- Name: ${contactName}
- Position: ${contactTitle}
- Company: ${company}

JOB CONTEXT:
- Job Title: ${jobTitle}
- Location: ${jobLocation}
- Workload: ${jobWorkload}
- Original Search Term: "${searchTerm}"

REQUIREMENTS:
1. Professional yet friendly tone
2. Keep it concise (3-4 short paragraphs max)
3. Reference the specific job posting naturally
4. Personalize based on their role (${contactTitle})
5. Clearly explain DESIGNSNACK's value proposition
6. Include a soft call-to-action
7. Don't be overly salesy
8. Make it feel genuine and researched

DESIGNSNACK VALUE PROPOSITION:
- Design subscription service for UX/UI design
- Perfect for companies that need consistent design work
- More cost-effective than hiring full-time designers
- Fast turnaround, professional quality
- Ideal for startups and growing companies

EMAIL STRUCTURE:
- Subject line
- Greeting with their name
- Brief connection to the job posting
- Value proposition tailored to their needs
- Soft call-to-action
- Professional signature

Write the complete email including subject line.
`;
}

// Save email draft for potential later use
export async function saveEmailDraft(job, contact, emailContent, searchTerm) {
  // This could be extended to save drafts to our storage system
  // For now, just return the data structure
  return {
    id: `draft_${Date.now()}`,
    timestamp: new Date().toISOString(),
    job,
    contact,
    emailContent,
    searchTerm,
    status: 'draft'
  };
}