# LLM UI - Electron AI Chat Application

An Electron application for AI-powered research conversations using the OpenRouter API.

## Features

- **AI Chat Interface**: Stream responses from various LLM models through OpenRouter
- **Spell Checking**: Highlights misspelled words in user input
- **Link Handling**: Click links in AI responses to open them in your browser
- **Context Menu**: Right-click to search selected text with your preferred search engine
- **Search Engine Options**: Choose between Google, Kagi, DuckDuckGo, or Bing
- **System Prompts**: 
  - Add multiple custom system prompts
  - Set a default prompt
  - Choose between prompts in the UI
  - Configure to send once or append to every message
- **Conversation Management**:
  - Auto-save conversations
  - Browse conversation history
  - Continue previous conversations
  - Export/import conversations as JSON

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the application:
   ```bash
   npm start
   ```

## Building

To build the application for your platform:

```bash
npm run build
```

For Linux AppImage:
```bash
npm run dist
```

## Configuration

1. **API Key**: Get your API key from [OpenRouter](https://openrouter.ai)
2. **Settings**: Access via the gear icon or Ctrl/Cmd + ,
3. **System Prompts**: Configure in settings to customize AI behavior
4. **Search Engine**: Select your preferred search engine in settings

## Usage

- **New Conversation**: Click the + button or Ctrl/Cmd + N
- **Send Message**: Type and press Enter (Shift+Enter for new line)
- **Stop Generation**: Click the stop button while AI is responding
- **Search Text**: Select text and right-click to search
- **Open Links**: Click any link in AI responses to open in browser

## Development

Run in development mode with DevTools:
```bash
npm run dev
```

## License

MIT