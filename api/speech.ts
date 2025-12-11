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

    // Create multipart form data manually for Vercel/Node.js compatibility
    const boundary = `----WebKitFormBoundary${Date.now()}`;
    const formParts: string[] = [];

    formParts.push(`--${boundary}`);
    formParts.push(`Content-Disposition: form-data; name="file"; filename="audio.webm"`);
    formParts.push(`Content-Type: audio/webm`);
    formParts.push('');
    formParts.push(audioBuffer.toString('binary'));

    formParts.push(`--${boundary}`);
    formParts.push(`Content-Disposition: form-data; name="model"`);
    formParts.push('');
    formParts.push(model);

    if (language) {
      formParts.push(`--${boundary}`);
      formParts.push(`Content-Disposition: form-data; name="language"`);
      formParts.push('');
      formParts.push(language);
    }

    if (prompt) {
      formParts.push(`--${boundary}`);
      formParts.push(`Content-Disposition: form-data; name="prompt"`);
      formParts.push('');
      formParts.push(prompt);
    }

    formParts.push(`--${boundary}--`);

    const formDataBody = Buffer.from(formParts.join('\r\n'), 'binary');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: formDataBody,
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

