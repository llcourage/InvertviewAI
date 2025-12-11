'use client';

import { useState } from 'react';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_VERCEL_API_URL || (typeof window !== 'undefined' ? '/api' : 'http://localhost:3000/api');

export default function Home() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages,
          model: 'gpt-4',
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.choices[0]?.message?.content || 'No response',
      };

      setMessages([...newMessages, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      setMessages([...newMessages, { role: 'assistant', content: 'Error: Failed to get response' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Interview AI</h1>
        
        <div className={styles.chat}>
          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.empty}>Start a conversation...</div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={styles.message} data-role={msg.role}>
                <div className={styles.messageContent}>{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className={styles.message} data-role="assistant">
                <div className={styles.messageContent}>Thinking...</div>
              </div>
            )}
          </div>

          <div className={styles.inputArea}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              className={styles.input}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className={styles.button}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

