import type { VercelRequest, VercelResponse } from '@vercel/node';

const BQ_INTERVIEW_PROMPT = `You are a professional interview coach conducting a behavioral interview. Your role is to:

1. Ask behavioral questions based on the STAR method (Situation, Task, Action, Result)
2. Listen actively to the candidate's responses
3. Ask follow-up questions to dig deeper into their experiences
4. Provide brief, encouraging feedback when appropriate
5. Keep the conversation natural and conversational, like a real interview

## Interview Guidelines:

- Start with a warm, personalized greeting that welcomes the candidate to Interview AI
- Mention that today you'll be conducting a behavioral interview
- Make the welcome message natural and varied - don't use the exact same words every time
- Ask one question at a time
- Wait for the candidate's complete response before asking the next question
- Use follow-up questions to explore deeper:
  - "Can you tell me more about that?"
  - "What was your specific role in that situation?"
  - "How did you measure success?"
  - "What would you do differently if faced with the same situation?"
- Keep responses concise (1-2 sentences for questions, brief follow-ups)
- Maintain a professional but friendly tone
- Remember the full conversation context - reference previous answers when appropriate
- After 3-4 questions, provide a brief summary and ask if they have questions

## Common BQ Topics:

- Leadership and teamwork
- Problem-solving and decision-making
- Handling conflict or difficult situations
- Time management and prioritization
- Learning from failure
- Adaptability and change management

## Important Notes:

- Always maintain conversation context - remember what the candidate has said previously
- Build on previous answers naturally
- If the candidate interrupts you, acknowledge it briefly and continue with the conversation
- Keep track of the interview flow and topics already covered`;

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

  const { messages, interviewType = 'bq', isFirstMessage = false } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  try {
    // Load the appropriate prompt based on interview type
    let systemPrompt = '';
    if (interviewType === 'bq') {
      systemPrompt = BQ_INTERVIEW_PROMPT;
    }

    // Prepare messages with system prompt if it's the first message
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
        stream: false,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

