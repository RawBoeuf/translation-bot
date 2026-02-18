# Discord Translation Bot

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)](https://nodejs.org)
[![Discord.js](https://img.shields.io/badge/Discord.js-14.x-blue?style=flat-square&logo=discord)](https://discord.js.org)
[![Express](https://img.shields.io/badge/Express-4.x-gray?style=flat-square)](https://expressjs.com)
[![AI Providers](https://img.shields.io/badge/AI-Ollama%20%7C%20OpenAI%20%7C%20Anthropic-orange?style=flat-square)](https://ollama.ai)

A Discord bot that translates messages in real-time using AI models (Ollama, OpenAI, Anthropic, Google, DeepSeek, xAI, Mistral), with a web dashboard for moderation.

## Features

- Automatic message translation using Ollama (local) or cloud AI providers
- Support for multiple AI providers: Ollama, OpenAI, Anthropic (Claude), Google AI (Gemini), DeepSeek, xAI (Grok), Mistral AI
- Image OCR (text recognition) using vision-capable models
- Web-based moderation dashboard
- Prefix commands ($) for configuration
- Role-based access control
- Per-channel settings (enable/disable, OCR toggle)
- Translation history and statistics

## Prerequisites

- Node.js 18+
- Discord bot token
- **For local AI (Ollama)**: [Ollama](https://ollama.ai/) installed with a translation model
- **For cloud AI providers**: API key from the respective provider (OpenAI, Anthropic, Google, DeepSeek, xAI, Mistral)

## Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/RawBoeuf/translation-bot.git
   cd translation-bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create a Discord bot:**
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Go to Bot section and create a bot
   - Enable **Message Content Intent** in the Bot section
   - Copy the bot token

4. **Start Ollama** (if using local AI) and ensure a model is installed:
   ```bash
   ollama pull gemma3
   ```
    
   For OCR features, use a vision-capable model:
   ```bash
   ollama pull gemma3:4b
   ```
   
   **Or** for cloud AI providers, get an API key from:
   - [OpenAI](https://platform.openai.com/api-keys)
   - [Anthropic](https://www.anthropic.com/api)
   - [Google AI](https://aistudio.google.com/app/apikey)
   - [DeepSeek](https://platform.deepseek.com/)
   - [xAI](https://console.x.ai/)
   - [Mistral AI](https://console.mistral.ai/)

5. **Invite the bot to your server:**
   - Go to OAuth2 > URL Generator
   - Select `bot` scope
   - Select `Send Messages`, `Read Message History` permissions
   - Use the generated URL to invite the bot

## Running the Bot

1. **Configure environment:**
   Copy `.env.example` to `.env` and add your bot token:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set:
   ```
   DISCORD_TOKEN=your_bot_token_here
   ```

2. **Start the bot:**
   ```bash
   npm start
   ```

## Dashboard

Access the moderation dashboard at: **http://localhost:3553**

Features:
- Bot and AI provider connection status
- AI provider selection (Ollama, OpenAI, Anthropic, Google, DeepSeek, xAI, Mistral)
- View/manage translation channels
- Enable/disable channels
- Toggle OCR (image text recognition) per channel
- Role-based access control
- Translation history
- Statistics
- Test translation and OCR tools

## Configuration

The bot uses a `.env` file for configuration. Copy `.env.example` to create your own:

| Variable | Description | Default |
|----------|-------------|---------|
| `DISCORD_TOKEN` | Your Discord bot token | (required) |
| `PORT` | Dashboard port | `3553` |
| `DASHBOARD_API_KEY` | API key for dashboard admin features | `translation-bot-secret` |

> **Security:** Change the default `DASHBOARD_API_KEY` before deploying. The default key is publicly known and should only be used for local development.

The bot also stores channel configuration in `translation-config.json`.

## Dashboard Authentication

The dashboard requires an API key to modify settings:

1. Enter the API key in the top-right input field on the dashboard
2. Go to "Admin Settings" tab to manage the API key and admin roles
3. Default API key: `translation-bot-secret` (change via `DASHBOARD_API_KEY` in `.env`)

**Note:** Without a valid API key, you can view status and history but cannot modify any settings.

## Commands

Both prefix commands and slash commands are supported:

### Prefix Commands ($)
| Command | Description |
|---------|-------------|
| `$translate set #channel <language>` | Set a channel for translation |
| `$translate remove #channel` | Remove translation from a channel |
| `$translate list` | List all configured translation channels |
| `$translate status` | Check bot and AI provider status |
| `$translate logs` | View recent bot logs |
| `$translate logchannel #channel` | Set log channel |
| `$translate logchannel remove` | Remove log channel |
| `$translate ocr enable #channel` | Enable OCR for a channel |
| `$translate ocr disable #channel` | Disable OCR for a channel |
| `$translate model` | Show current and available translation models |
| `$translate model <name>` | Set the translation model |
| `$translate ocrmodel` | Show current and available OCR models |
| `$translate ocrmodel <name>` | Set the OCR model |
| `$translate provider` | Show current and available AI providers |
| `$translate provider <name>` | Set the AI provider (ollama, openai, anthropic, google, deepseek, xai, mistral) |
| `$translate help` | Show available commands |

### Slash Commands (/)
| Command | Description |
|---------|-------------|
| `/translate set #channel <language>` | Set a channel for translation |
| `/translate remove #channel` | Remove translation from a channel |
| `/translate list` | List all configured translation channels |
| `/translate status` | Check bot and AI provider status |
| `/translate logs` | View recent bot logs |
| `/translate logchannel set #channel` | Set log channel |
| `/translate logchannel remove` | Remove log channel |
| `/translate ocr enable #channel` | Enable OCR for a channel |
| `/translate ocr disable #channel` | Disable OCR for a channel |
| `/translate model` | Show current and available translation models |
| `/translate model <name>` | Set the translation model |
| `/translate ocrmodel` | Show current and available OCR models |
| `/translate ocrmodel <name>` | Set the OCR model |
| `/translate provider` | Show current and available AI providers |
| `/translate provider <name>` | Set the AI provider (ollama, openai, anthropic, google, deepseek, xai, mistral) |
| `/translate help` | Show available commands |

## OCR Feature

The bot supports image text recognition (OCR) using vision-capable AI models:

1. Enable OCR in dashboard under "Channel Settings" tab
2. When users post images in enabled channels, the bot will:
   - Extract text from the image
   - Translate the extracted text
3. Use the "Image OCR Test" in the dashboard to test OCR

**Note:** OCR requires a vision-capable model:
- Ollama: gemma3:4b or larger, llava
- OpenAI: gpt-4o, gpt-4o-mini
- Anthropic: claude-3-5-sonnet
- Google: gemini-1.5-pro, gemini-1.5-flash

## Recommended Models

### Local AI (Ollama)

| Purpose | Model | Install Command | Notes |
|---------|-------|-----------------|-------|
| Translation | `gemma3` | `ollama pull gemma3` | Strong multilingual translation quality |
| OCR | `ministral-3` | `ollama pull ministral-3` | Fast and accurate text extraction from images |

### Cloud AI Providers

| Provider | Translation Model | OCR Model | Notes |
|----------|-----------------|-----------|-------|
| OpenAI | `gpt-4o`, `gpt-4o-mini` | `gpt-4o` | Fast, reliable |
| Anthropic | `claude-3-5-sonnet-20241022` | `claude-3-5-sonnet-20241022` | Excellent quality |
| Google | `gemini-1.5-pro`, `gemini-1.5-flash` | `gemini-1.5-pro` | Good value |
| DeepSeek | `deepseek-chat` | - | Affordable |
| xAI | `grok-2-1212` | - | Fast |
| Mistral | `mistral-large-latest` | - | Good multilingual |

**Note:** OCR is only available with vision-capable models (gpt-4o, Claude Sonnet, Gemini Pro).

### Setting Up Cloud Providers

1. Get an API key from your preferred provider
2. Use the dashboard Admin Settings tab to:
   - Select your AI provider
   - Enter your API key
   - Set the base URL (if different from default)

Or use Discord commands:
```
$translate provider openai
$translate model gpt-4o
```

You can set models via the dashboard or Discord commands:
```
$translate model gpt-4o
$translate ocrmodel gpt-4o
```

## Troubleshooting

- **Ollama not connecting**: Ensure Ollama is running on `http://localhost:11434`
- **Cloud API not working**: Verify your API key is correct and has sufficient credits
- **Bot offline**: Verify your Discord token is correct
- **Translations not working**: 
  - For Ollama: Check that model is installed (`ollama list`)
  - For cloud providers: Check API key and provider status
- **OCR not working**: Ensure you're using a vision-capable model

## Contributing

Contributions are welcome! Please open an [issue](https://github.com/RawBoeuf/translation-bot/issues) or submit a [pull request](https://github.com/RawBoeuf/translation-bot/pulls).

## Testing

Run the automated test suite:

```bash
npm test
```

This will verify:
- Server is running and serving HTML
- All API endpoints are working (/api/status, /api/stats, /api/config, /api/logs, /api/history, /api/translate, /api/models)
- Config file exists and is valid
- Environment file exists and has required fields
- JavaScript syntax is valid
- Frontend HTML is valid

**Note:** The server must be running (`npm start`) before executing tests.

## License

This project is licensed under the [MIT License](LICENSE).
