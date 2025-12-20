import { NextRequest, NextResponse } from 'next/server';
import FormData from 'form-data';
import { Readable } from 'stream';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { audio, model = 'whisper-1', language, prompt } = body;

    if (!audio) {
      return NextResponse.json(
        { error: 'Audio data is required' },
        { status: 400 }
      );
    }

    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Use form-data package for proper multipart/form-data encoding
    const formData = new FormData();
    
    // Create a readable stream from buffer
    const audioStream = Readable.from(audioBuffer);
    
    // Append file as stream with proper metadata
    formData.append('file', audioStream, {
      filename: 'audio.webm',
      contentType: 'audio/webm',
      knownLength: audioBuffer.length,
    });
    formData.append('model', model);
    if (language) formData.append('language', language);
    if (prompt) formData.append('prompt', prompt);

    // Get headers (includes Content-Type with boundary)
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      ...formData.getHeaders(),
    };

    // Use node-fetch or native fetch with proper form-data handling
    // For Node.js, we need to use a library that properly handles form-data streams
    const https = require('https');
    const http = require('http');
    
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: 'api.openai.com',
        path: '/v1/audio/transcriptions',
        method: 'POST',
        headers: headers,
      };

      const req = https.request(requestOptions, (res: any) => {
        let data = '';
        
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const jsonData = JSON.parse(data);
              resolve(NextResponse.json(jsonData));
            } catch (e) {
              reject(NextResponse.json({ error: 'Failed to parse response' }, { status: 500 }));
            }
          } else {
            console.error('OpenAI API error:', data);
            resolve(NextResponse.json({ error: data }, { status: res.statusCode || 500 }));
          }
        });
      });

      req.on('error', (error: Error) => {
        console.error('Request error:', error);
        reject(NextResponse.json({ error: error.message }, { status: 500 }));
      });

      // Pipe form-data to request
      formData.pipe(req);
    });
  } catch (error: any) {
    console.error('Error calling OpenAI Whisper:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

