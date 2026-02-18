# Discord Translation Bot Specification

## Project Overview
- **Project name**: Discord Translation Bot
- **Repository**: https://github.com/RawBoeuf/translation-bot
- **Type**: Discord bot with AI translation + web dashboard
- **Core functionality**: Translates all messages in a Discord channel to a target language using Ollama's gemma3 model
- **Target users**: Discord server administrators/mods
- **Dashboard**: http://localhost:3553

## Functionality Specification

### Core Features
1. **Ollama Integration**: Connect to local Ollama API (http://localhost:11434) using gemma3 model
2. **Channel Translation**: Monitor and translate all messages in specified channels
3. **Target Language**: Configurable target language per channel
4. **OCR/Text Recognition**: Extract and translate text from images using gemma3 vision
5. **Role-based Access**: Restrict translation to specific roles per channel
6. **Ignored Users**: Block specific users from being translated

### Commands (Prefix: $) and Slash Commands (/)
- `$translate set <channel> <language>` - Set a channel to translate to a specific language
- `$translate remove <channel>` - Remove translation from a channel
- `$translate list` - List all translation channels
- `$translate status` - Check bot and Ollama status
- `$translate logs` - View recent bot logs
- `$translate logchannel <channel>` - Set log channel for bot messages
- `$translate logchannel remove` - Remove log channel
- `$translate ocr enable <channel>` - Enable OCR for a channel
- `$translate ocr disable <channel>` - Disable OCR for a channel
- `$translate model` - Show current and available translation models
- `$translate model <name>` - Set the translation model
- `$translate ocrmodel` - Show current and available OCR models
- `$translate ocrmodel <name>` - Set the OCR model
- `$translate help` - Show available commands

### Web Dashboard Features
- System status (bot, Ollama, channels, translations count)
- Channel management (add, remove, enable/disable, toggle OCR)
- Translation history
- Statistics (translations by language)
- Role access management (translation roles, OCR roles)
- Admin roles management
- Ignored users management
- Quick translation test
- Image OCR test
- API key authentication for protected endpoints
- Model selection (translation model and OCR model)
- Debug settings (toggle debug messages in activity log)
- Log channel configuration (info/translation/error logs)
- Debug log channel configuration (separate channel for debug logs)

### Authentication
- API key required for all configuration endpoints
- Configurable via `DASHBOARD_API_KEY` environment variable
- Default key: `translation-bot-secret`
- Public endpoints (no auth): status, logs, history, stats, config (read-only)

### Data Handling
- Store translation channel configs in a JSON file (translation-config.json)
- Config structure: 
  ```json
  {
    "channels": {
      "channelId": {
        "language": "string",
        "guildId": "string",
        "channelName": "string",
        "enabled": boolean,
        "enableOcr": boolean
      }
    },
    "ignoredUsers": ["userId1", "userId2"],
    "allowedRoles": {
      "channelId": [{"id": "roleId", "name": "roleName"}]
    },
    "ocrRoles": {
      "channelId": [{"id": "roleId", "name": "roleName"}]
    },
    "adminRoles": [{"id": "roleId", "name": "roleName"}],
    "logChannel": "channelId",
    "debugLogChannel": "channelId",
    "model": "string",
    "ocrModel": "string"
  }
  ```

### Edge Cases
- Ollama not running → Bot logs error, continues running
- Model not available → Bot logs error message
- Translation fails → Bot logs error, doesn't respond
- Message is too long → Truncate to 1024 chars
- OCR fails → Bot logs error, skips image
- Role not found → Translation open to all users

## Acceptance Criteria
1. Bot connects to Discord and responds to commands
2. Bot successfully calls Ollama API and gets translations
3. Messages in configured channels are translated automatically
4. OCR extracts text from images and translates
5. Role-based access restricts translation to allowed roles
6. Config persists across bot restarts
7. Dashboard displays real-time status and history
8. API key protects all configuration endpoints
9. Admin can configure API key and admin roles
