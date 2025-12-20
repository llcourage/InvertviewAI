import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  const { audio, model = 'whisper-1', language, prompt } = req.body;

  if (!audio) {
    return res.status(400).json({ error: 'Audio data is required' });
  }

  try {
    // TODO: Add usage/plan checking here

    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Create FormData using native FormData (Node.js 18+)
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', model);
    if (language) formData.append('language', language);
    if (prompt) formData.append('prompt', prompt);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error calling OpenAI Whisper:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

