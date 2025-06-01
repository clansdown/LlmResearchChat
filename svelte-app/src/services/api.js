import axios from 'axios';
import { get } from 'svelte/store';
import { settings, webSearchPlugin } from '../stores/settings.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

// Cache for available models
let modelsCache = null;
let modelsCacheTime = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function getAvailableModels() {
  // Check cache
  if (modelsCache && modelsCacheTime && Date.now() - modelsCacheTime < CACHE_DURATION) {
    return modelsCache;
  }
  
  try {
    const response = await axios.get(`${OPENROUTER_API_URL}/models`);
    const models = response.data.data
      .filter(model => !model.id.includes(':free'))
      .map(model => ({
        id: model.id,
        name: model.name || model.id,
        context_length: model.context_length,
        pricing: model.pricing
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Update cache
    modelsCache = models;
    modelsCacheTime = Date.now();
    
    return models;
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}

export async function sendMessage(messages, onChunk) {
  const currentSettings = get(settings);
  const useWebSearch = get(webSearchPlugin);
  
  if (!currentSettings.apiKey) {
    throw new Error('API key not set');
  }
  
  const headers = {
    'Authorization': `Bearer ${currentSettings.apiKey}`,
    'HTTP-Referer': window.location.origin,
    'X-Title': 'LLM Research Chat'
  };
  
  const body = {
    model: currentSettings.model,
    messages,
    stream: true
  };
  
  // Add web search plugin if enabled
  if (useWebSearch) {
    body.tools = [{
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the web for information'
      }
    }];
    body.tool_choice = 'auto';
  }
  
  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API request failed');
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let totalContent = '';
  let cost = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices[0]?.delta;
          
          if (delta?.content) {
            totalContent += delta.content;
            onChunk(delta.content);
          }
          
          // Extract cost from usage data
          if (parsed.usage) {
            const model = parsed.model;
            const pricing = modelsCache?.find(m => m.id === model)?.pricing;
            if (pricing) {
              cost = (parsed.usage.prompt_tokens * pricing.prompt + 
                     parsed.usage.completion_tokens * pricing.completion) / 1000000;
            }
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      }
    }
  }
  
  return { content: totalContent, cost };
}