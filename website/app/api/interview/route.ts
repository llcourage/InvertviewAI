import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to load prompt from file (supports both .md and .txt)
function loadPrompt(promptName: string): string {
  try {
    // Try .txt first (for simple prompts like opening_greeting)
    let promptPath = path.join(process.cwd(), 'prompts', `${promptName}.txt`);
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, 'utf-8');
    }
    // Fallback to .md
    promptPath = path.join(process.cwd(), 'prompts', `${promptName}.md`);
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, 'utf-8');
    }
    return '';
  } catch (error) {
    console.error(`Error loading prompt ${promptName}:`, error);
    // Fallback to default prompt
    return '';
  }
}

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
    const { messages, interviewType = 'bq', isFirstMessage = false } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Map interview type to human-readable description
    const interviewTypeMap: Record<string, string> = {
      'bq': 'behavioral question',
      'behavioral': 'behavioral question',
      'behavioral_question': 'behavioral question',
      'technical': 'technical',
      'system_design': 'system design',
      'cultural_fit': 'cultural fit',
    };
    
    const interviewTypeDescription = interviewTypeMap[interviewType.toLowerCase()] || interviewType;

    // Load the appropriate prompt based on interview type and whether it's the first message
    let systemPrompt = '';
    if (isFirstMessage) {
      // Use opening greeting prompt for first message
      systemPrompt = loadPrompt('opening_greeting');
      // Replace {INTERVIEW_TYPE} placeholder with actual interview type
      systemPrompt = systemPrompt.replace(/{INTERVIEW_TYPE}/g, interviewTypeDescription);
      // Fallback to bq_interview_opening if opening_greeting not found
      if (!systemPrompt) {
        systemPrompt = loadPrompt('bq_interview_opening');
        systemPrompt = systemPrompt.replace(/{INTERVIEW_TYPE}/g, interviewTypeDescription);
      }
    } else {
      // Use regular interview prompt for subsequent messages
      // Load based on interview type
      if (interviewType === 'bq' || interviewType === 'behavioral' || interviewType === 'behavioral_question') {
        systemPrompt = loadPrompt('bq_interview');
      } else {
        // For other interview types, try to load specific prompt or use default
        systemPrompt = loadPrompt(`${interviewType}_interview`) || loadPrompt('bq_interview');
      }
    }
    
    // Fallback if prompt loading failed
    if (!systemPrompt) {
      systemPrompt = `You are a professional interview coach conducting a behavioral interview. Ask behavioral questions based on the STAR method and listen actively to responses.`;
    }

    // Always include system prompt to maintain context
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        stream: true, // Enable streaming
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    // Return streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              controller.close();
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data === '[DONE]') {
                  controller.close();
                  return;
                }

                try {
                  const json = JSON.parse(data);
                  const content = json.choices[0]?.delta?.content || '';
                  
                  if (content) {
                    // Send each chunk as SSE format
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

