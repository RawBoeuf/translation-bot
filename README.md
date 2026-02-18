# Discord Translation Bot

A Discord bot that translates messages in real-time using Ollama API, with a web dashboard for moderation.

## Features

- Automatic message translation using local Ollama API
- Image OCR (text recognition) using Ollama's vision model capability.
- Web-based moderation dashboard
- Prefix commands ($) for configuration
- Role-based access control
- Per-channel settings (enable/disable, OCR toggle)
- Translation history and statistics

## Prerequisites

- Node.js 18+
- Discord bot token
- [Ollama](https://ollama.ai/) installed with gemma3 model (vision model recommended for OCR)

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

4. **Start Ollama** and ensure gemma3 is installed:
   ```bash
   ollama pull gemma3
   ```
   
   For OCR features, use a vision-capable model:
   ```bash
   ollama pull gemma3:4b
   ```

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
- Bot and Ollama connection status
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
| `$translate status` | Check bot and Ollama status |
| `$translate logs` | View recent bot logs |
| `$translate logchannel #channel` | Set log channel |
| `$translate logchannel remove` | Remove log channel |
| `$translate ocr enable #channel` | Enable OCR for a channel |
| `$translate ocr disable #channel` | Disable OCR for a channel |
| `$translate model` | Show current and available translation models |
| `$translate model <name>` | Set the translation model |
| `$translate ocrmodel` | Show current and available OCR models |
| `$translate ocrmodel <name>` | Set the OCR model |
| `$translate help` | Show available commands |

### Slash Commands (/)
| Command | Description |
|---------|-------------|
| `/translate set #channel <language>` | Set a channel for translation |
| `/translate remove #channel` | Remove translation from a channel |
| `/translate list` | List all configured translation channels |
| `/translate status` | Check bot and Ollama status |
| `/translate logs` | View recent bot logs |
| `/translate logchannel set #channel` | Set log channel |
| `/translate logchannel remove` | Remove log channel |
| `/translate ocr enable #channel` | Enable OCR for a channel |
| `/translate ocr disable #channel` | Disable OCR for a channel |
| `/translate model` | Show current and available translation models |
| `/translate model <name>` | Set the translation model |
| `/translate ocrmodel` | Show current and available OCR models |
| `/translate ocrmodel <name>` | Set the OCR model |
| `/translate help` | Show available commands |

## OCR Feature

The bot supports image text recognition (OCR) using Ollama's vision capabilities:

1. Enable OCR in dashboard under "Channel Settings" tab
2. When users post images in enabled channels, the bot will:
   - Extract text from the image
   - Translate the extracted text
3. Use the "Image OCR Test" in the dashboard to test OCR

Note: OCR requires a vision-capable model (i.e. gemma3:4b+).

## Recommended Models

As of February 17, 2026, the following models are recommended for use with this bot:

| Purpose | Model | Install Command | Notes |
|---------|-------|-----------------|-------|
| Translation | `gemma3` | `ollama pull gemma3` | Strong multilingual translation quality |
| OCR | `ministral-3` | `ollama pull ministral-3` | Fast and accurate text extraction from images |

You can set these via the dashboard Admin Settings or with Discord commands:
```
$translate model gemma3
$translate ocrmodel ministral-3
```

## Troubleshooting

- **Ollama not connecting**: Ensure Ollama is running on `http://localhost:11434`
- **Bot offline**: Verify your Discord token is correct
- **Translations not working**: Check that gemma3 model is installed (`ollama list`)
- **OCR not working**: Ensure you're using a vision-capable model (gemma3:4b or larger)

## Contributing

Contributions are welcome! Please open an [issue](https://github.com/RawBoeuf/translation-bot/issues) or submit a [pull request](https://github.com/RawBoeuf/translation-bot/pulls).

## License

This project is licensed under the [MIT License](LICENSE).
