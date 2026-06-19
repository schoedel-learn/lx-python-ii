import { Injectable, inject } from '@angular/core';
import OpenAI from 'openai';
import { UserProfile } from './auth.service';
import { MemoryService } from './memory.service';
import { collection, doc, setDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { buildLearningMessages, buildSystemInstruction } from './learning-agent-request';

// Using the global variable defined in globals.d.ts or .env
declare const OPENAI_API_KEY: string;
declare const DEFAULT_AI_MODEL: string | undefined;

export interface ChatMessage {
  id?: string;
  role: 'user' | 'model' | 'system' | 'assistant';
  content: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class LearningAgentService {
  private ai: OpenAI;
  private memoryService = inject(MemoryService);

  constructor() {
    this.ai = new OpenAI({ 
      apiKey: typeof OPENAI_API_KEY !== 'undefined' ? OPENAI_API_KEY : '', 
      dangerouslyAllowBrowser: true 
    });
  }

  async getChatHistory(): Promise<ChatMessage[]> {
    const user = auth.currentUser;
    if (!user) return [];

    try {
      const chatsRef = collection(db, `users/${user.uid}/chats`);
      const q = query(chatsRef, orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ChatMessage));
    } catch (error) {
      console.error('Error fetching chat history:', error);
      return [];
    }
  }

  async saveChatMessage(role: 'user' | 'model' | 'system' | 'assistant', content: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const chatsRef = collection(db, `users/${user.uid}/chats`);
      const newChatRef = doc(chatsRef);
      
      await setDoc(newChatRef, {
        role,
        content,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  }

  async sendExecutionFeedback(code: string, output: string, userProfile: UserProfile | null): Promise<string> {
    const message = `[System Context: I just executed the following code in my editor:\n\n\`\`\`python\n${code}\n\`\`\`\n\nExecution Result:\n${output}\n\nPlease provide brief, encouraging feedback or hints if there's an error. Do not write the full solution for me.]`;
    return this.sendMessage(message, userProfile, true);
  }

  async sendMessage(message: string, userProfile: UserProfile | null, isHiddenFromUI = false): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // 1. Save user message (if it's not a hidden system context message)
    if (!isHiddenFromUI) {
      await this.saveChatMessage('user', message);
    }

    // 2. Fetch context
    const memories = await this.memoryService.getMemories();
    const memoryString = memories.length > 0 
      ? memories.map(m => `- [${m.category}] ${m.content}`).join('\n')
      : 'No memories recorded yet.';

    const systemInstruction = buildSystemInstruction(userProfile, memoryString);

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'save_learner_memory',
          description: 'Save an insight, preference, milestone, or struggle about the learner to their permanent memory log.',
          parameters: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                enum: ['preference', 'milestone', 'struggle', 'general'],
                description: 'The category of the memory.',
              },
              content: {
                type: 'string',
                description: 'The content of the memory to save.',
              },
            },
            required: ['category', 'content'],
          },
        }
      }
    ];

    // 3. Fetch previous chat history to build the session
    const history = await this.getChatHistory();
    
    const messages = buildLearningMessages(systemInstruction, history, message);

    const modelName = typeof DEFAULT_AI_MODEL !== 'undefined' ? DEFAULT_AI_MODEL : 'gpt-5.4-mini';

    try {
      const response = await this.ai.chat.completions.create({
        model: modelName,
        messages: messages,
        temperature: 0.7,
        tools: tools,
        reasoning_effort: 'medium' // Requested by user for models that support it
      });

      const responseMessage = response.choices[0].message;
      let finalResponseText = responseMessage.content || '';

      // Handle function calls
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        messages.push(responseMessage); // Add the assistant's tool call to history
        
        for (const toolCall of responseMessage.tool_calls) {
          if (toolCall.type === 'function' && toolCall.function.name === 'save_learner_memory') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              if (args.category && args.content) {
                await this.memoryService.saveMemory(args.category, args.content);
                
                // Send the result back to the model
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ status: 'success', message: 'Memory saved successfully.' })
                });
              }
            } catch (e) {
              console.error('Failed to parse tool call arguments:', e);
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ status: 'error', message: 'Invalid JSON arguments' })
              });
            }
          }
        }
        
        // Get the final response after tool execution
        const secondResponse = await this.ai.chat.completions.create({
          model: modelName,
          messages: messages,
          temperature: 0.7,
          reasoning_effort: 'medium'
        });
        
        finalResponseText = secondResponse.choices[0].message.content || finalResponseText;
      }

      // 4. Save AI response
      await this.saveChatMessage('model', finalResponseText);
      return finalResponseText;

    } catch (error) {
      console.error('Error in chat:', error);
      throw error;
    }
  }
}
