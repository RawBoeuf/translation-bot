# Usage Guide

For setup and installation, see the [README](https://github.com/RawBoeuf/translation-bot#readme).

## Adding Translation to a Channel

### Using Discord Commands

1. **Set up translation for a channel:**
   ```
   $translate set #channel-name spanish
   ```
   
   Replace `spanish` with your desired target language (e.g., french, german, japanese, etc.)

2. **Verify it's working:**
   ```
   $translate status
   ```

### Using the Dashboard

1. Open http://localhost:3553
2. Enter API key in the top-right field (default: `translation-bot-secret`)
3. In the "Translation Channels" section, enter:
   - Channel ID (enable Developer Mode in Discord → right-click channel → Copy ID)
   - Target Language
4. Click **Add**

## How Translation Works

Once a channel is configured:
1. Any user message in that channel triggers the bot
2. The message is sent to the configured AI provider
3. The bot replies with an embed showing:
   - The original message
   - The translated message

**Example:**
```
User posts: "Hello everyone, how are you today?"

Bot replies with:
┌─────────────────────────────────────┐
│  Original                           │
│  Hello everyone, how are you today? │
│                                     │
│  Translated (spanish)                │
│  Hola a todos, cómo están hoy?      │
└─────────────────────────────────────┘
```

## Managing Channels

### List Active Translations
```
$translate list
```

### Remove Translation
```
$translate remove #channel-name
```

### Check System Status
```
$translate status
```

Shows:
- Bot connection status
- AI provider status
- Available AI models (for Ollama)

### View Recent Logs
```
$translate logs
```

Shows the last 10 log entries from the bot.

### Set Log Channel
```
$translate logchannel #channel-name
$translate logchannel remove
```

Configure a Discord channel to receive bot logs (translations, errors, info).

**Note:** Debug logs are sent to a separate channel if configured in dashboard Admin Settings.

### Enable/Disable OCR
```
$translate ocr enable #channel-name
$translate ocr disable #channel-name
```

Toggle image text recognition for a specific channel.

### Change Translation Model
```
$translate model
$translate model <model-name>
```

View or change the AI model used for text translation. For cloud providers, enter the model name manually.

### Change OCR Model
```
$translate ocrmodel
$translate ocrmodel <model-name>
```

View or change the AI model used for image text extraction. Defaults to the translation model if not set.

### Change AI Provider
```
$translate provider
$translate provider <provider-name>
```

View or change the AI provider. Available providers: `ollama`, `openai`, `anthropic`, `google`, `deepseek`, `xai`, `mistral`

### Show Help
```
$translate help
```

Displays all available commands.

## Supported Languages

The bot uses AI models which support many languages. Common examples:
- spanish / espanol
- french
- german
- italian
- portuguese
- japanese
- korean
- chinese
- russian
- arabic

You can use any language name the AI model recognizes.

## Dashboard Features

### Status Panel
- Bot online/offline status
- AI provider connection status
- Number of active translation channels
- Total translations count

### Admin Settings (API Key Required)
- **API Key**: Authentication for protected actions
- **AI Provider**: Select provider (Ollama, OpenAI, Anthropic, Google, DeepSeek, xAI, Mistral)
- **API Key**: Enter API key for cloud providers
- **Base URL**: Custom endpoint (optional)
- **Debug Settings**: Toggle debug messages in Activity Log
- **Log Channel**: Configure Discord channel for bot logs (info, translation, error)
- **Debug Log Channel**: Configure separate Discord channel for debug logs
- **Admin Roles**: Manage admin roles
- **Translation Model**: Select or enter the AI model to use for text translation
- **OCR Model**: Select or enter the AI model to use for image text extraction (defaults to translation model)

### Channel Management
- View all configured channels
- Enable/disable channels
- Toggle OCR (image text recognition)
- Change target language
- Remove channels directly from the UI

### Translation History
- View recent translations
- See original and translated text
- Filter by channel/author

### Role Access
- **Translation Roles**: Restrict translation to specific roles per channel
- **OCR Roles**: Restrict OCR/image translation to specific roles per channel
- If no roles set for either, anyone can use that feature
- OCR roles only apply in channels where OCR is enabled

### Ignored Users
- Block specific users from being translated
- Add user IDs to ignore list

### Test Tools
- **Quick Test**: Enter text to translate
- **Image OCR Test**: Upload image to extract and translate text

## API Key Authentication

The dashboard requires an API key to modify settings:

1. **Enter API Key**: Type your API key in the top-right input field
2. **Default Key**: `translation-bot-secret` (set via `DASHBOARD_API_KEY` in `.env`)

> **Security:** Change the default `DASHBOARD_API_KEY` before deploying. The default key is publicly known and should only be used for local development.
3. **Admin Settings Tab**: View and manage admin roles

**Without API Key**: You can view status, history, and stats but cannot modify any settings.

**Protected Actions** (require API key):
- Adding/removing channels
- Enabling/disabling channels
- Toggling OCR
- Managing roles (translation, OCR, admin)
- Ignoring users
- Test translation/OCR tools

## OCR (Image Text Recognition)

The bot can extract and translate text from images:

1. **Enable OCR** for a channel:
   - Go to "Channel Settings" tab in dashboard
   - Click "OCR" button to enable

2. **How it works**:
   - When users post images in OCR-enabled channels
   - Bot extracts text using vision-capable AI model
   - Translates the extracted text

3. **Testing OCR**:
   - Use "Image OCR Test" in the dashboard
   - Upload an image
   - Select target language
   - Click "Extract & Translate"

**Note**: OCR requires a vision-capable model:
- Ollama: gemma3:4b, llava
- OpenAI: gpt-4o
- Anthropic: Claude 3.5 Sonnet
- Google: Gemini 1.5 Pro

## Tips

1. **Test first**: Use a test channel to verify translations work correctly
2. **Language accuracy**: Some languages may have varying accuracy depending on the model
3. **Response time**: Translation depends on Ollama's response time (usually 1-5 seconds)
4. **Ignore bots**: The bot automatically ignores messages from other bots to prevent loops
5. **OCR performance**: Image processing takes longer than text-only translation

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No translation appears | Check `$translate status` - ensure AI provider is configured |
| Bot not responding | Verify the bot has permission to send messages in the channel |
| "Channel not found" error | Use `$translate set` in Discord directly rather than manual ID entry |
| Slow translations | Check AI provider response times |
| OCR not working | Ensure you're using a vision-capable model |
| Cloud API errors | Verify API key and account credits |
