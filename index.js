require('dotenv').config();

const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');

const CONFIG_FILE = path.join(__dirname, 'translation-config.json');
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const DEFAULT_MODEL = 'gemma3';
const DASHBOARD_PORT = process.env.PORT || 3553;
const COMMAND_PREFIX = '$';
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY; // Undefined = no auth required

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let config = { channels: {}, ignoredUsers: [], allowedRoles: {}, ocrRoles: {}, adminRoles: [], logChannel: null, debugLogChannel: null, model: DEFAULT_MODEL, ocrModel: null };
let logs = [];
let showDebug = false;
let translationHistory = [];
let stats = { totalTranslations: 0, languages: {} };

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const loaded = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      config = { channels: {}, ignoredUsers: [], allowedRoles: {}, ocrRoles: {}, adminRoles: [], logChannel: null, debugLogChannel: null, model: DEFAULT_MODEL, ocrModel: null, ...loaded };
    } catch (e) {
      config = { channels: {}, ignoredUsers: [], allowedRoles: {}, ocrRoles: {}, adminRoles: [], logChannel: null, debugLogChannel: null, model: DEFAULT_MODEL, ocrModel: null };
    }
  }
}

function getModel() {
  return config.model || DEFAULT_MODEL;
}

function getOcrModel() {
  return config.ocrModel || config.model || DEFAULT_MODEL;
}

function saveConfig() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function addLog(type, message) {
  logs.unshift({ type, message, time: new Date().toISOString() });
  if (logs.length > 100) logs.pop();
  
  if (config.logChannel && (type === 'info' || type === 'error' || type === 'translation')) {
    const color = type === 'error' ? 0xed4245 : type === 'translation' ? 0x3ba55c : 0x5865f2;
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`Log: ${type}`)
      .setDescription(message)
      .setTimestamp();
    sendToLogChannel(embed);
  }
  
  if (config.debugLogChannel && type === 'debug') {
    const embed = new EmbedBuilder()
      .setColor(0xf0a500)
      .setTitle(`Debug: ${type}`)
      .setDescription(message)
      .setTimestamp();
    sendToLogChannel(embed, true);
  }
}

function requireAdmin(req, res, next) {
  const apiKey = req.headers['x-api-key'] || '';
  const expectedKey = DASHBOARD_API_KEY;
  
  // If no API key is configured, allow access (for development)
  if (!expectedKey) {
    return next();
  }
  
  if (apiKey !== expectedKey) {
    return res.status(403).json({ error: 'Forbidden: Invalid or missing API key' });
  }
  next();
}

function addDebug(message) {
  logs.unshift({ type: 'debug', message, time: new Date().toISOString() });
  if (logs.length > 100) logs.pop();
}

app.get('/api/status', async (req, res) => {
  const ollamaStatus = await checkOllamaStatus();
  
  const channelsWithGuilds = await Promise.all(Object.entries(config.channels).map(async ([id, data]) => {
    let guildName = 'Unknown Server';
    let channelName = data.channelName || 'Unknown';
    
    if (data.guildId && client.guilds.cache.has(data.guildId)) {
      const guild = client.guilds.cache.get(data.guildId);
      guildName = guild.name;
      
      // Try to fetch channel name from Discord if not stored
      if (!data.channelName) {
        try {
          const channel = await guild.channels.fetch(id);
          if (channel) channelName = channel.name;
        } catch (e) {
          // Channel not found or inaccessible
        }
      }
    }
    
    return { id, ...data, channelName, guildName };
  }));
  
  res.json({
    bot: client.user ? { tag: client.user.tag, ready: client.readyAt ? true : false } : null,
    ollama: ollamaStatus,
    channels: channelsWithGuilds
  });
});

app.get('/api/logs', (req, res) => {
  res.json(logs.slice(0, 50));
});

app.post('/api/channels', requireAdmin, (req, res) => {
  const { channelId, channelName, language, guildId } = req.body;
  config.channels[channelId] = { language, guildId, channelName };
  saveConfig();
  addLog('info', `Added translation channel: #${channelName} → ${language}`);
  res.json({ success: true });
});

app.delete('/api/channels/:channelId', requireAdmin, (req, res) => {
  const { channelId } = req.params;
  if (config.channels[channelId]) {
    const name = config.channels[channelId].channelName;
    delete config.channels[channelId];
    saveConfig();
    addLog('info', `Removed translation channel: #${name}`);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Channel not found' });
  }
});

async function extractTextFromImage(imageBase64) {
  const prompt = 'Extract ALL text from this image. Preserve formatting as much as possible. Do not add any commentary, only output the extracted text.';
  
  try {
    const response = await axios.post(OLLAMA_URL, {
      model: getOcrModel(),
      prompt: prompt,
      images: [imageBase64],
      stream: false
    }, {
      timeout: 120000
    });
    
    return response.data.response.trim();
  } catch (error) {
    console.error('OCR error:', error.message);
    throw error;
  }
}

app.post('/api/ocr', async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image required (base64 encoded)' });
  }
  try {
    const extractedText = await extractTextFromImage(image);
    res.json({ extractedText });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ocr-translate', async (req, res) => {
  const { image, language } = req.body;
  if (!image || !language) {
    return res.status(400).json({ error: 'Image and language required' });
  }
  try {
    const extractedText = await extractTextFromImage(image);
    const translation = await translateWithOllama(extractedText, language);
    res.json({ extractedText, translation, language });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/channels/:channelId', requireAdmin, (req, res) => {
  const { channelId } = req.params;
  const { language, enabled, enableOcr } = req.body;
  if (config.channels[channelId]) {
    if (language) config.channels[channelId].language = language;
    if (enabled !== undefined) config.channels[channelId].enabled = enabled;
    if (enableOcr !== undefined) config.channels[channelId].enableOcr = enableOcr;
    saveConfig();
    addLog('info', `Updated channel #${config.channels[channelId].channelName}`);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Channel not found' });
  }
});

app.post('/api/translate', async (req, res) => {
  const { text, language } = req.body;
  if (!text || !language) {
    return res.status(400).json({ error: 'Text and language required' });
  }
  try {
    const translation = await translateWithOllama(text, language);
    res.json({ original: text, translation, language });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/history', (req, res) => {
  res.json(translationHistory.slice(0, 100));
});

app.get('/api/stats', (req, res) => {
  res.json(stats);
});

app.get('/api/config', (req, res) => {
  const channelsWithGuilds = Object.entries(config.channels).map(([id, data]) => {
    let guildName = 'Unknown Server';
    let channelName = data.channelName || 'Unknown';
    
    if (data.guildId && client.guilds.cache.has(data.guildId)) {
      const guild = client.guilds.cache.get(data.guildId);
      guildName = guild.name;
    }
    
    return { id, ...data, channelName, guildName };
  });
  
  res.json({
    ignoredUsers: config.ignoredUsers || [],
    allowedRoles: config.allowedRoles || {},
    ocrRoles: config.ocrRoles || [],
    adminRoles: config.adminRoles || [],
    channels: channelsWithGuilds
  });
});

app.get('/api/admin-roles', (req, res) => {
  res.json({ adminRoles: config.adminRoles || [] });
});

app.post('/api/admin-roles', requireAdmin, (req, res) => {
  const { roleId, roleName } = req.body;
  if (!config.adminRoles) config.adminRoles = [];
  
  const exists = config.adminRoles.find(r => r.id === roleId);
  if (!exists) {
    config.adminRoles.push({ id: roleId, name: roleName || roleId });
    saveConfig();
    addLog('info', `Added admin role: ${roleName || roleId}`);
  }
  res.json({ success: true, adminRoles: config.adminRoles });
});

app.delete('/api/admin-roles/:roleId', requireAdmin, (req, res) => {
  const { roleId } = req.params;
  if (config.adminRoles) {
    config.adminRoles = config.adminRoles.filter(r => r.id !== roleId);
    saveConfig();
    addLog('info', `Removed admin role: ${roleId}`);
  }
  res.json({ success: true, adminRoles: config.adminRoles || [] });
});

app.post('/api/ocr-roles/:channelId', requireAdmin, (req, res) => {
  const { channelId } = req.params;
  const { roleId, roleName } = req.body;
  if (!config.ocrRoles) config.ocrRoles = {};
  if (!config.ocrRoles[channelId]) config.ocrRoles[channelId] = [];
  
  const exists = config.ocrRoles[channelId].find(r => r.id === roleId);
  if (!exists) {
    config.ocrRoles[channelId].push({ id: roleId, name: roleName || roleId });
    saveConfig();
    addLog('info', `Added OCR role: ${roleName || roleId}`);
  }
  res.json({ success: true });
});

app.delete('/api/ocr-roles/:channelId/:roleId', requireAdmin, (req, res) => {
  const { channelId, roleId } = req.params;
  if (config.ocrRoles && config.ocrRoles[channelId]) {
    config.ocrRoles[channelId] = config.ocrRoles[channelId].filter(r => r.id !== roleId);
    saveConfig();
    addLog('info', `Removed OCR role: ${roleId}`);
  }
  res.json({ success: true });
});

app.post('/api/roles/:channelId', requireAdmin, (req, res) => {
  const { channelId } = req.params;
  const { roleId, roleName } = req.body;
  if (!config.allowedRoles) config.allowedRoles = {};
  if (!config.allowedRoles[channelId]) config.allowedRoles[channelId] = [];
  
  const exists = config.allowedRoles[channelId].find(r => r.id === roleId);
  if (!exists) {
    config.allowedRoles[channelId].push({ id: roleId, name: roleName || roleId });
    saveConfig();
    addLog('info', `Added allowed role: ${roleName || roleId}`);
  }
  res.json({ success: true });
});

app.delete('/api/roles/:channelId/:roleId', requireAdmin, (req, res) => {
  const { channelId, roleId } = req.params;
  if (config.allowedRoles && config.allowedRoles[channelId]) {
    config.allowedRoles[channelId] = config.allowedRoles[channelId].filter(r => r.id !== roleId);
    saveConfig();
    addLog('info', `Removed allowed role: ${roleId}`);
  }
  res.json({ success: true });
});

app.post('/api/ignore/:userId', requireAdmin, (req, res) => {
  const { userId } = req.params;
  if (!config.ignoredUsers) config.ignoredUsers = [];
  if (!config.ignoredUsers.includes(userId)) {
    config.ignoredUsers.push(userId);
    saveConfig();
    addLog('info', `Ignored user: ${userId}`);
  }
  res.json({ success: true });
});

app.delete('/api/ignore/:userId', requireAdmin, (req, res) => {
  const { userId } = req.params;
  if (config.ignoredUsers) {
    config.ignoredUsers = config.ignoredUsers.filter(id => id !== userId);
    saveConfig();
  }
  res.json({ success: true });
});

app.get('/api/settings', (req, res) => {
  res.json({
    showDebug,
    logChannel: config.logChannel,
    debugLogChannel: config.debugLogChannel,
    model: getModel(),
    ocrModel: getOcrModel()
  });
});

app.put('/api/settings', requireAdmin, (req, res) => {
  const { showDebug: newShowDebug, logChannel: newLogChannel, debugLogChannel: newDebugLogChannel, model: newModel, ocrModel: newOcrModel } = req.body;
  if (newShowDebug !== undefined) showDebug = newShowDebug;
  if (newLogChannel !== undefined) {
    config.logChannel = newLogChannel;
    saveConfig();
    addLog('info', newLogChannel ? `Log channel set to: ${newLogChannel}` : 'Log channel disabled');
  }
  if (newDebugLogChannel !== undefined) {
    config.debugLogChannel = newDebugLogChannel;
    saveConfig();
    addLog('info', newDebugLogChannel ? `Debug log channel set to: ${newDebugLogChannel}` : 'Debug log channel disabled');
  }
  if (newModel !== undefined) {
    config.model = newModel;
    saveConfig();
    addLog('info', `Translation model changed to: ${newModel}`);
  }
  if (newOcrModel !== undefined) {
    config.ocrModel = newOcrModel || null;
    saveConfig();
    addLog('info', newOcrModel ? `OCR model changed to: ${newOcrModel}` : 'OCR model reset to default');
  }
  res.json({ success: true, showDebug, logChannel: config.logChannel, debugLogChannel: config.debugLogChannel, model: getModel(), ocrModel: getOcrModel() });
});

app.get('/api/models', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:11434/api/tags');
    const models = response.data.models || [];
    res.json({ models: models.map(m => m.name), current: getModel(), ocrCurrent: getOcrModel() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch models from Ollama', available: false });
  }
});

async function sendToLogChannel(embed, isDebug = false) {
  const channelId = isDebug ? config.debugLogChannel : config.logChannel;
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Failed to send to log channel:', error.message);
  }
}

async function translateWithOllama(text, targetLanguage) {
  const prompt = `Translate the following message to ${targetLanguage}. Only respond with the translation, nothing else:\n\n${text}`;
  
  try {
    const response = await axios.post(OLLAMA_URL, {
      model: getModel(),
      prompt: prompt,
      stream: false
    }, {
      timeout: 60000
    });
    
    return response.data.response.trim();
  } catch (error) {
    console.error('Ollama translation error:', error.message);
    addLog('error', `Translation failed: ${error.message}`);
    throw error;
  }
}

async function checkOllamaStatus() {
  try {
    const response = await axios.get('http://localhost:11434/api/tags', { timeout: 5000 });
    const models = response.data.models || [];
    const gemmaAvailable = models.some(m => m.name.startsWith('gemma3'));
    return { available: gemmaAvailable, models };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

client.on('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Dashboard available at http://localhost:${DASHBOARD_PORT}`);
  addLog('info', `Bot connected as ${client.user.tag}`);
  registerCommands();
});

async function registerCommands() {
  try {
    const commands = await client.application.commands.fetch();
    
    const translateCommand = new SlashCommandBuilder()
      .setName('translate')
      .setDescription('Manage message translation')
      .addSubcommand(sub =>
        sub.setName('set')
          .setDescription('Set a channel for translation')
          .addChannelOption(opt => opt.setName('channel').setDescription('Channel to translate').setRequired(true))
          .addStringOption(opt => opt.setName('language').setDescription('Target language').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('remove')
          .setDescription('Remove translation from a channel')
          .addChannelOption(opt => opt.setName('channel').setDescription('Channel to remove').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('list')
          .setDescription('List all translation channels')
      )
      .addSubcommand(sub =>
        sub.setName('status')
          .setDescription('Check bot and Ollama status')
      )
      .addSubcommand(sub =>
        sub.setName('logs')
          .setDescription('View recent bot logs')
      )
      .addSubcommand(sub =>
        sub.setName('logchannel')
          .setDescription('Configure log channel')
          .addStringOption(opt => opt.setName('action').setDescription('Action: set or remove'))
          .addChannelOption(opt => opt.setName('channel').setDescription('Channel for logs'))
      )
      .addSubcommand(sub =>
        sub.setName('ocr')
          .setDescription('Enable/disable OCR for a channel')
          .addStringOption(opt => opt.setName('action').setDescription('Action: enable or disable').setRequired(true))
          .addChannelOption(opt => opt.setName('channel').setDescription('Channel to configure').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('model')
          .setDescription('Get or set the translation model')
          .addStringOption(opt => opt.setName('name').setDescription('Model name (leave empty to see current)'))
      )
      .addSubcommand(sub =>
        sub.setName('ocrmodel')
          .setDescription('Get or set the OCR model')
          .addStringOption(opt => opt.setName('name').setDescription('Model name (leave empty to see current)'))
      )
      .addSubcommand(sub =>
        sub.setName('help')
          .setDescription('Show available commands')
      );
    
    const existing = commands.find(c => c.name === 'translate');
    if (existing) {
      await client.application.commands.edit(existing.id, translateCommand);
      console.log('Updated slash commands');
    } else {
      await client.application.commands.create(translateCommand);
      console.log('Registered slash commands');
    }
  } catch (e) {
    console.error('Failed to register commands:', e.message);
  }
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  
  const { commandName, options, guildId, guild } = interaction;
  
  if (commandName === 'translate') {
    const subcommand = options.getSubcommand();
    
    if (subcommand === 'set') {
      const channel = options.getChannel('channel');
      const language = options.getString('language');
      
      config.channels[channel.id] = { language, guildId, channelName: channel.name };
      saveConfig();
      
      await interaction.reply(`✅ Translation set for #${channel.name} → ${language}`);
    }
    
    if (subcommand === 'remove') {
      const channel = options.getChannel('channel');
      
      if (config.channels[channel.id]) {
        delete config.channels[channel.id];
        saveConfig();
        await interaction.reply(`✅ Translation removed for #${channel.name}`);
      } else {
        await interaction.reply(`⚠️ No translation set for #${channel.name}`);
      }
    }
    
    if (subcommand === 'list') {
      const entries = Object.entries(config.channels);
      if (entries.length === 0) {
        await interaction.reply('No translation channels configured.');
      } else {
        let description = '';
        for (const [channelId, data] of entries) {
          const channel = guild.channels.cache.get(channelId);
          if (channel) {
            description += `#${channel.name} → ${data.language}\n`;
          }
        }
        const embed = new EmbedBuilder()
          .setTitle('Translation Channels')
          .setDescription(description || 'No active translations');
        await interaction.reply({ embeds: [embed] });
      }
    }
    
    if (subcommand === 'status') {
      const status = await checkOllamaStatus();
      let description = `**Bot**: ✅ Running\n`;
      description += `**Ollama**: ${status.available ? '✅ Available' : '❌ Not available'}\n`;
      
      if (status.models) {
        description += `**Models**: ${status.models.map(m => m.name).join(', ')}`;
      } else if (status.error) {
        description += `**Error**: ${status.error}`;
      }
      
      const embed = new EmbedBuilder()
        .setTitle('Bot Status')
        .setDescription(description);
      await interaction.reply({ embeds: [embed] });
    }
    
    if (subcommand === 'logs') {
      const recentLogs = logs.slice(0, 10);
      if (recentLogs.length === 0) {
        await interaction.reply('No logs available.');
      } else {
        const description = recentLogs.map(l => 
          `[${new Date(l.time).toLocaleTimeString()}] **${l.type}**: ${l.message}`
        ).join('\n');
        const embed = new EmbedBuilder()
          .setTitle('Recent Logs')
          .setDescription(description.length > 4000 ? description.slice(0, 3997) + '...' : description);
        await interaction.reply({ embeds: [embed] });
      }
    }
    
    if (subcommand === 'logchannel') {
      const action = options.getString('action');
      const channel = options.getChannel('channel');
      
      if (action === 'remove') {
        config.logChannel = null;
        saveConfig();
        await interaction.reply('✅ Log channel removed.');
      } else if (channel) {
        config.logChannel = channel.id;
        saveConfig();
        addLog('info', `Log channel set to #${channel.name}`);
        await interaction.reply(`✅ Log channel set to #${channel.name}`);
      } else {
        await interaction.reply('Usage: /translate logchannel set #channel\n/translate logchannel remove');
      }
    }
    
    if (subcommand === 'ocr') {
      const action = options.getString('action');
      const channel = options.getChannel('channel');
      
      if (!config.channels[channel.id]) {
        await interaction.reply(`⚠️ Translation not configured for #${channel.name}. Use /translate set first.`);
        return;
      }
      
      if (action === 'enable') {
        config.channels[channel.id].enableOcr = true;
        saveConfig();
        await interaction.reply(`✅ OCR enabled for #${channel.name}`);
      } else if (action === 'disable') {
        config.channels[channel.id].enableOcr = false;
        saveConfig();
        await interaction.reply(`✅ OCR disabled for #${channel.name}`);
      } else {
        await interaction.reply('Usage: /translate ocr enable #channel\n/translate ocr disable #channel');
      }
    }
    
    if (subcommand === 'model') {
      const modelName = options.getString('name');
      
      if (!modelName) {
        const currentModel = getModel();
        try {
          const response = await axios.get('http://localhost:11434/api/tags');
          const models = response.data.models || [];
          const modelList = models.map(m => m.name).join('\n') || 'No models available';
          const embed = new EmbedBuilder()
            .setTitle('🤖 Translation Model')
            .setColor(0x5865f2)
            .addFields(
              { name: 'Current Model', value: currentModel, inline: false },
              { name: 'Available Models', value: modelList, inline: false }
            );
          await interaction.reply({ embeds: [embed] });
        } catch (e) {
          await interaction.reply(`Current model: **${currentModel}** (Ollama unavailable)`);
        }
        return;
      }
      
      config.model = modelName;
      saveConfig();
      addLog('info', `Translation model changed to: ${modelName}`);
      await interaction.reply(`✅ Translation model set to: **${modelName}**`);
    }
    
    if (subcommand === 'ocrmodel') {
      const modelName = options.getString('name');
      
      if (!modelName) {
        const currentOcrModel = getOcrModel();
        try {
          const response = await axios.get('http://localhost:11434/api/tags');
          const models = response.data.models || [];
          const modelList = models.map(m => m.name).join('\n') || 'No models available';
          const embed = new EmbedBuilder()
            .setTitle('📷 OCR Model')
            .setColor(0xf0a500)
            .addFields(
              { name: 'Current OCR Model', value: currentOcrModel, inline: false },
              { name: 'Available Models', value: modelList, inline: false }
            );
          await interaction.reply({ embeds: [embed] });
        } catch (e) {
          await interaction.reply(`Current OCR model: **${currentOcrModel}** (Ollama unavailable)`);
        }
        return;
      }
      
      config.ocrModel = modelName;
      saveConfig();
      addLog('info', `OCR model changed to: ${modelName}`);
      await interaction.reply(`✅ OCR model set to: **${modelName}**`);
    }
    
    if (subcommand === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('🤖 Translation Bot Commands')
        .setColor(0x5865f2)
        .addFields(
          { name: '/translate set #channel <language>', value: 'Set a channel for translation', inline: false },
          { name: '/translate remove #channel', value: 'Remove translation from a channel', inline: false },
          { name: '/translate ocr enable #channel', value: 'Enable OCR for a channel', inline: false },
          { name: '/translate ocr disable #channel', value: 'Disable OCR for a channel', inline: false },
          { name: '/translate model', value: 'Show current and available translation models', inline: false },
          { name: '/translate model <name>', value: 'Set the translation model', inline: false },
          { name: '/translate ocrmodel', value: 'Show current and available OCR models', inline: false },
          { name: '/translate ocrmodel <name>', value: 'Set the OCR model', inline: false },
          { name: '/translate list', value: 'List all configured channels', inline: false },
          { name: '/translate status', value: 'Check bot and Ollama status', inline: false },
          { name: '/translate logs', value: 'View recent bot logs', inline: false },
          { name: '/translate logchannel #channel', value: 'Set log channel', inline: false },
          { name: '/translate logchannel remove', value: 'Remove log channel', inline: false },
          { name: '/translate help', value: 'Show this help message', inline: false }
        );
      await interaction.reply({ embeds: [embed] });
    }
  }
});

client.on('messageCreate', async (message) => {
  addDebug(`Message received from ${message.author.username} in #${message.channel.name}: "${message.content?.slice(0, 50)}..."`);
  
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.content.startsWith(COMMAND_PREFIX)) return;
  
  const channelConfig = config.channels[message.channel.id];
  if (!channelConfig) {
    addDebug(`No config for channel #${message.channel.name}, skipping`);
    return;
  }
  if (channelConfig.enabled === false) {
    addDebug(`Channel #${message.channel.name} is disabled, skipping`);
    return;
  }
  
  const ignoredUsers = config.ignoredUsers || [];
  if (ignoredUsers.includes(message.author.id)) {
    addDebug(`User ${message.author.username} is ignored, skipping`);
    return;
  }
  
  const allowedRoles = config.allowedRoles || {};
  const channelRoles = allowedRoles[message.channel.id];
  
  if (channelRoles && channelRoles.length > 0) {
    const member = await message.guild.members.fetch(message.author.id);
    const userRoleIds = member.roles.cache.map(r => r.id);
    const hasAllowedRole = channelRoles.some(r => userRoleIds.includes(r.id));
    
    if (!hasAllowedRole) {
      addDebug(`User ${message.author.username} lacks required roles for #${message.channel.name}, skipping`);
      return;
    }
    addDebug(`User ${message.author.username} has required role for #${message.channel.name}`);
  } else {
    addDebug(`No role restriction for #${message.channel.name}, allowing all`);
  }
  
  let contentToTranslate = message.content;
  let hasImage = false;
  let extractedText = null;
  
  const imageAttachments = message.attachments.filter(a => 
    a.contentType && a.contentType.startsWith('image/')
  );
  
  addDebug(`Image attachments found: ${imageAttachments.size}, OCR enabled: ${channelConfig.enableOcr}`);
  
  if (imageAttachments.size > 0 && channelConfig.enableOcr) {
    const ocrRoles = config.ocrRoles || {};
    const channelOcrRoles = ocrRoles[message.channel.id];
    
    let canUseOcr = true;
    if (channelOcrRoles && channelOcrRoles.length > 0) {
      const member = await message.guild.members.fetch(message.author.id);
      const userRoleIds = member.roles.cache.map(r => r.id);
      canUseOcr = channelOcrRoles.some(r => userRoleIds.includes(r.id));
      addDebug(`OCR role check for ${message.author.username}: ${canUseOcr}`);
    }
    
    if (canUseOcr) {
      addDebug(`Starting OCR for image in #${message.channel.name}`);
      try {
        const attachment = imageAttachments.first();
        const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
        const base64 = Buffer.from(response.data).toString('base64');
        extractedText = await extractTextFromImage(base64);
        hasImage = true;
        addLog('ocr', `#${message.channel.name}: ${message.author.username} - Extracted text from image`);
        addDebug(`OCR completed, extracted ${extractedText?.length || 0} characters`);
      } catch (error) {
        console.error('OCR failed:', error.message);
        addLog('error', `OCR failed: ${error.message}`);
      }
    } else {
      addDebug(`User lacks OCR role, skipping OCR`);
    }
  }
  
  if (!contentToTranslate && !extractedText) {
    addDebug(`No content to translate for #${message.channel.name}`);
    return;
  }
  
  addDebug(`Processing translation for #${message.channel.name} to ${channelConfig.language}`);
  
  try {
    const fields = [];
    
    if (extractedText) {
      addDebug(`Translating OCR text (${extractedText.length} chars) to ${channelConfig.language}`);
      const ocrTranslation = await translateWithOllama(extractedText, channelConfig.language);
      addDebug(`OCR translation complete: "${ocrTranslation?.slice(0, 50)}..."`);
      fields.push(
        { name: '📷 Extracted Text', value: extractedText.length > 1024 ? extractedText.slice(0, 1021) + '...' : extractedText },
        { name: `📷 Translated (${channelConfig.language})`, value: ocrTranslation.length > 1024 ? ocrTranslation.slice(0, 1021) + '...' : ocrTranslation }
      );
      
      translationHistory.unshift({
        original: extractedText,
        translation: ocrTranslation,
        language: channelConfig.language,
        channel: message.channel.name,
        author: message.author.username,
        isOcr: true,
        time: new Date().toISOString()
      });
      if (translationHistory.length > 100) translationHistory.pop();
      
      stats.totalTranslations++;
      stats.languages[channelConfig.language] = (stats.languages[channelConfig.language] || 0) + 1;
    }
    
    if (contentToTranslate && contentToTranslate.trim()) {
      addDebug(`Translating message text (${contentToTranslate.length} chars) to ${channelConfig.language}`);
      const textTranslation = await translateWithOllama(contentToTranslate, channelConfig.language);
      addDebug(`Text translation complete: "${textTranslation?.slice(0, 50)}..."`);
      fields.push(
        { name: 'Original', value: contentToTranslate.length > 1024 ? contentToTranslate.slice(0, 1021) + '...' : contentToTranslate },
        { name: `Translated (${channelConfig.language})`, value: textTranslation.length > 1024 ? textTranslation.slice(0, 1021) + '...' : textTranslation }
      );
      
      translationHistory.unshift({
        original: contentToTranslate,
        translation: textTranslation,
        language: channelConfig.language,
        channel: message.channel.name,
        author: message.author.username,
        isOcr: false,
        time: new Date().toISOString()
      });
      if (translationHistory.length > 100) translationHistory.pop();
      
      stats.totalTranslations++;
      stats.languages[channelConfig.language] = (stats.languages[channelConfig.language] || 0) + 1;
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
      .addFields(fields)
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
    addLog('translation', `#${message.channel.name}: ${message.author.username} → ${channelConfig.language}${hasImage ? ' (OCR)' : ''}`);
  } catch (error) {
    console.error('Translation failed:', error.message);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!message.content.startsWith(COMMAND_PREFIX)) return;

  const args = message.content.slice(COMMAND_PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  if (command !== 'translate') return;

  const subcommand = args.shift()?.toLowerCase();

  if (subcommand === 'set') {
    const channelMention = args[0];
    const language = args.slice(1).join(' ');
    
    let channelId = message.channel.id;
    let channelName = message.channel.name;
    
    if (channelMention && channelMention.startsWith('<#') && channelMention.endsWith('>')) {
      channelId = channelMention.slice(2, -1);
      const channel = message.guild.channels.cache.get(channelId);
      if (channel) channelName = channel.name;
    }
    
    if (!language) {
      await message.reply('Usage: $translate set #channel <language>');
      return;
    }
    
    config.channels[channelId] = { language, guildId: message.guild.id, channelName };
    saveConfig();
    addLog('info', `Added translation channel: #${channelName} → ${language}`);
    await message.reply(`✅ Translation set for #${channelName} → ${language}`);
  }
  
  else if (subcommand === 'remove') {
    const channelMention = args[0];
    let channelId = message.channel.id;
    let channelName = message.channel.name;
    
    if (channelMention && channelMention.startsWith('<#') && channelMention.endsWith('>')) {
      channelId = channelMention.slice(2, -1);
      const channel = message.guild.channels.cache.get(channelId);
      if (channel) channelName = channel.name;
    }
    
    if (config.channels[channelId]) {
      delete config.channels[channelId];
      saveConfig();
      addLog('info', `Removed translation channel: #${channelName}`);
      await message.reply(`✅ Translation removed for #${channelName}`);
    } else {
      await message.reply(`⚠️ No translation set for #${channelName}`);
    }
  }
  
  else if (subcommand === 'list') {
    const entries = Object.entries(config.channels);
    if (entries.length === 0) {
      await message.reply('No translation channels configured.');
    } else {
      let description = '';
      for (const [channelId, data] of entries) {
        const channel = message.guild.channels.cache.get(channelId);
        if (channel) {
          description += `#${channel.name} → ${data.language}\n`;
        }
      }
      const embed = new EmbedBuilder()
        .setTitle('Translation Channels')
        .setDescription(description || 'No active translations');
      await message.reply({ embeds: [embed] });
    }
  }
  
  else if (subcommand === 'status') {
    const status = await checkOllamaStatus();
    let description = `**Bot**: ✅ Running\n`;
    description += `**Ollama**: ${status.available ? '✅ Available' : '❌ Not available'}\n`;
    
    if (status.models) {
      description += `**Models**: ${status.models.map(m => m.name).join(', ')}`;
    } else if (status.error) {
      description += `**Error**: ${status.error}`;
    }
    
    const embed = new EmbedBuilder()
      .setTitle('Bot Status')
      .setDescription(description);
    await message.reply({ embeds: [embed] });
  }
  
  else if (subcommand === 'logs') {
    const recentLogs = logs.slice(0, 10);
    if (recentLogs.length === 0) {
      await message.reply('No logs available.');
    } else {
      const description = recentLogs.map(l => 
        `[${new Date(l.time).toLocaleTimeString()}] **${l.type}**: ${l.message}`
      ).join('\n');
      const embed = new EmbedBuilder()
        .setTitle('Recent Logs')
        .setDescription(description.length > 4000 ? description.slice(0, 3997) + '...' : description);
      await message.reply({ embeds: [embed] });
    }
  }
  
  else if (subcommand === 'logchannel') {
    const action = args[0]?.toLowerCase();
    
    if (action === 'remove' || action === 'disable') {
      config.logChannel = null;
      saveConfig();
      await message.reply('✅ Log channel removed.');
    } else if (action === 'set' || action === undefined) {
      let channelId = message.channel.id;
      let channelName = message.channel.name;
      
      const channelMention = args[1] || args[0];
      if (channelMention && channelMention.startsWith('<#') && channelMention.endsWith('>')) {
        channelId = channelMention.slice(2, -1);
        const channel = message.guild.channels.cache.get(channelId);
        if (channel) channelName = channel.name;
      }
      
      config.logChannel = channelId;
      saveConfig();
      addLog('info', `Log channel set to #${channelName}`);
      await message.reply(`✅ Log channel set to #${channelName}`);
    } else {
      await message.reply('Usage: $translate logchannel #channel\n$translate logchannel remove');
    }
  }
  
  else if (subcommand === 'ocr') {
    const action = args[0]?.toLowerCase();
    let channelId = message.channel.id;
    let channelName = message.channel.name;
    
    const channelMention = args[1];
    if (channelMention && channelMention.startsWith('<#') && channelMention.endsWith('>')) {
      channelId = channelMention.slice(2, -1);
      const channel = message.guild.channels.cache.get(channelId);
      if (channel) channelName = channel.name;
    } else if (channelMention && args[1]) {
      channelId = args[1];
    }
    
    if (!config.channels[channelId]) {
      await message.reply(`⚠️ Translation not configured for #${channelName}. Use $translate set first.`);
      return;
    }
    
    if (action === 'enable' || action === 'on') {
      config.channels[channelId].enableOcr = true;
      saveConfig();
      await message.reply(`✅ OCR enabled for #${channelName}`);
    } else if (action === 'disable' || action === 'off') {
      config.channels[channelId].enableOcr = false;
      saveConfig();
      await message.reply(`✅ OCR disabled for #${channelName}`);
    } else {
      await message.reply('Usage: $translate ocr enable #channel\n$translate ocr disable #channel');
    }
  }
  
  else if (subcommand === 'model') {
    const modelName = args[0];
    
    if (!modelName) {
      const currentModel = getModel();
      try {
        const response = await axios.get('http://localhost:11434/api/tags');
        const models = response.data.models || [];
        const modelList = models.map(m => m.name).join('\n') || 'No models available';
        const embed = new EmbedBuilder()
          .setTitle('🤖 Translation Model')
          .setColor(0x5865f2)
          .addFields(
            { name: 'Current Model', value: currentModel, inline: false },
            { name: 'Available Models', value: modelList, inline: false }
          );
        await message.reply({ embeds: [embed] });
      } catch (e) {
        await message.reply(`Current model: **${currentModel}** (Ollama unavailable)`);
      }
      return;
    }
    
    config.model = modelName;
    saveConfig();
    addLog('info', `Translation model changed to: ${modelName}`);
    await message.reply(`✅ Translation model set to: **${modelName}**`);
  }
  
  else if (subcommand === 'ocrmodel') {
    const modelName = args[0];
    
    if (!modelName) {
      const currentOcrModel = getOcrModel();
      try {
        const response = await axios.get('http://localhost:11434/api/tags');
        const models = response.data.models || [];
        const modelList = models.map(m => m.name).join('\n') || 'No models available';
        const embed = new EmbedBuilder()
          .setTitle('📷 OCR Model')
          .setColor(0xf0a500)
          .addFields(
            { name: 'Current OCR Model', value: currentOcrModel, inline: false },
            { name: 'Available Models', value: modelList, inline: false }
          );
        await message.reply({ embeds: [embed] });
      } catch (e) {
        await message.reply(`Current OCR model: **${currentOcrModel}** (Ollama unavailable)`);
      }
      return;
    }
    
    config.ocrModel = modelName;
    saveConfig();
    addLog('info', `OCR model changed to: ${modelName}`);
    await message.reply(`✅ OCR model set to: **${modelName}**`);
  }
  
  else if (subcommand === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('🤖 Translation Bot Commands')
      .setColor(0x5865f2)
      .addFields(
        { name: '$translate set #channel <language>', value: 'Set a channel for translation', inline: false },
        { name: '$translate remove #channel', value: 'Remove translation from a channel', inline: false },
        { name: '$translate ocr enable #channel', value: 'Enable OCR for a channel', inline: false },
        { name: '$translate ocr disable #channel', value: 'Disable OCR for a channel', inline: false },
        { name: '$translate model', value: 'Show current translation model', inline: false },
        { name: '$translate model <name>', value: 'Set the translation model', inline: false },
        { name: '$translate ocrmodel', value: 'Show current OCR model', inline: false },
        { name: '$translate ocrmodel <name>', value: 'Set the OCR model', inline: false },
        { name: '$translate list', value: 'List all configured channels', inline: false },
        { name: '$translate status', value: 'Check bot and Ollama status', inline: false },
        { name: '$translate logs', value: 'View recent bot logs', inline: false },
        { name: '$translate logchannel #channel', value: 'Set log channel', inline: false },
        { name: '$translate logchannel remove', value: 'Remove log channel', inline: false },
        { name: '$translate help', value: 'Show this help message', inline: false }
      );
    await message.reply({ embeds: [embed] });
  }
   
  else {
    await message.reply(`Available commands:\n$translate set #channel <language>\n$translate remove #channel\n$translate ocr enable #channel\n$translate ocr disable #channel\n$translate model\n$translate model <name>\n$translate ocrmodel\n$translate ocrmodel <name>\n$translate list\n$translate status\n$translate logs\n$translate logchannel #channel\n$translate logchannel remove\n$translate help`);
  }
});

loadConfig();

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('Please set DISCORD_TOKEN in .env file or environment variable');
  process.exit(1);
}

client.login(TOKEN);

app.listen(DASHBOARD_PORT, () => {
  console.log(`Dashboard running on http://localhost:${DASHBOARD_PORT}`);
});
