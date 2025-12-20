import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as fs from 'fs';
import * as path from 'path';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type = 'bq_interview' } = req.query;

  try {
    // In Vercel, we need to read from the file system
    // The prompts folder should be accessible
    const promptPath = path.join(process.cwd(), 'prompts', `${type}.md`);
    
    // For Vercel serverless, we might need to use a different approach
    // Let's try reading the file
    let promptContent = '';
    
    try {
      promptContent = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
      // Fallback: return a default prompt if file not found
      console.error('Error reading prompt file:', error);
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json({
      prompt: promptContent,
      type: type as string,
    });
  } catch (error) {
    console.error('Error loading prompt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}


