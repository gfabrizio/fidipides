# Fidipides

A VS Code extension that sends Telegram notifications for your own private chat when Copilot changes files.
Go grab a coffee, Fidipides will notify you when your code is ready :)


## How It Works

This is a heuristic approach, since apparently there is no official interface or API to consume.  
The extension collects all files changed (based on the `batchSeconds` setting) after a chat interaction.

- Copilot chat response completions (detected by document scheme and content patterns)  
- File modifications triggered by Copilot chat (in a pre-defined interval of seconds, all changed files will generate a notification sent to Telegram)


## Setup

### 1. Create a Telegram Bot

1. Open Telegram and search for **@BotFather**  
2. Send `/newbot` and follow the instructions  
3. Save your **Bot Token**
4. Get your **Chat ID**:  
   - Add your bot to a chat or group  
   - Send any message to the chat  
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`  
   - Copy the `message.chat.id` value  

> 📖 **Telegram Bot Docs**: [Creating a Telegram Bot](https://core.telegram.org/bots/tutorial)


### 2. Development Setup

```bash
# Clone and install dependencies
git clone <your-repo-url>
cd fidipides
npm install

# Build the extension
npm run compile

# Run tests
npm test

# Run linting
npm run lint
```


### 3. Configure VS Code

1. Press **F5** to launch Development Host  
2. In the new VS Code window, open Settings (Cmd/Ctrl + ,)  
3. Search for "Fidipides"  
4. Configure:  
   - **Telegram Bot Token**: Your bot token from step 1  
   - **Chat Id**: Your chat ID from step 1  
   - Adjust other settings as needed  
   - Batch Seconds


### 4. Test the Setup

1. Open Command Palette (Cmd/Ctrl + Shift + P)  
2. Run: **Fidipides  Alert: Send Telegram Ping**  
3. You should receive a test message in Telegram  


## Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| `telegramBotToken` | "" | Bot token from @BotFather |
| `chatId` | "" | Telegram chat ID to receive notifications |
| `cooldownSeconds` | 45 | Cooldown period to prevent spam |
| `batchSeconds` | 60 | Time window to batch file changes before sending notifications |


## Running Locally

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes during development
npm run watch

# Run tests
npm run test

```


## Testing

The extension includes comprehensive tests:

```bash
# Run all tests (integration + unit)
npm test

```

### Test Structure

- `src/test/extension.test.ts` - Extension activation and command registration tests  
- `src/test/telegramNotifier.test.ts` - Core notification logic tests  
- `src/test/utils.test.ts` - Utility function tests  
- `src/test/suite/` - VS Code test runner configuration  



## Local Installation (Unpublished Extension)

To install the extension locally (without publishing to the Marketplace):

1. Build the VSIX package:
   ```bash
   npm run package
   # This creates a .vsix file in your project directory
   ```
2. In VS Code, open the Command Palette (Cmd/Ctrl+Shift+P) and run:
   **Extensions: Install from VSIX...**
3. Select the generated `.vsix` file (e.g., `copilot-telegram-alert-0.1.0.vsix`)
4. The extension will be installed locally and available in your Extensions panel.
5. Go to the extension page and update the settings to add your Telegram credentials and set the number of seconds to wait before sending the message.


## Contributing

1. Fork the repository  
2. Create a feature branch: `git checkout -b feature/whatsapp`  
3. Make your changes and add tests  
4. Run tests: `npm test`  
5. Commit: `git commit -m 'Add support to whatsapp'`  
6. Push: `git push origin feature/whatsapp`  
7. Create a Pull Request  


## Troubleshooting

### Common Issues

**"Configure the Telegram credentials" Error**  
- Ensure both `telegramBotToken` and `chatId` are set in VS Code settings  
- Verify your bot token is correct (test with @BotFather)  
- Check that your chat ID is numeric (not a username)  

**No Notifications Received**  
- Check that the bot is added to your target chat  
- Verify the chat ID by sending a message and checking `/getUpdates`  
- Ensure the cooldown period hasn't been triggered  

### Debug

Enable verbose logging by checking VS Code's Developer Console:  
1. Help → Toggle Developer Tools  
2. Check the Console tab for extension logs  


## Limitations

- Can't access Copilot's internal state, relies on text change patterns  
- Large copy/paste operations may trigger notifications  
- Subject to Telegram rate limits and API availability


## License

MIT - see [LICENSE](LICENSE) file for details.


## Changelog

### v0.1.0
- Initial release with Copilot detection and Telegram notifications  
- Comprehensive test suite  
- Modern TypeScript architecture
