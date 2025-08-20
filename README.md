# Copilot Telegram Alert

Sends you a Telegram message when a **likely** inline suggestion is accepted in VS Code.
This is a heuristic proxy for “Copilot completion accepted”.

## Why heuristic?
VS Code doesn’t expose Copilot internals. We detect large, instantaneous insertions (typical of accepting inline suggestions). You can tune thresholds to reduce false positives.

## Setup

1. **Telegram bot**
   - Talk to **@BotFather** → `/newbot` → get your **BOT_TOKEN**.
   - Get your **chat_id**: add the bot to the target chat → send any message → open `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates` and copy `message.chat.id`.

2. **Install deps**
   ```bash
   npm install
   ```

3. **Build**
   ```bash
   npm run compile
   ```

4. **Launch in VS Code**
   - Press **F5** to open the Extension Development Host.
   - Open settings and set:
     - `Copilot Telegram Alert › Telegram Bot Token`
     - `Copilot Telegram Alert › Chat Id`

5. **Test**
   - Command Palette → **Copilot Telegram Alert: Send Test Ping**.

## Configuration

- `copilotTelegramAlert.minChars` (default: 60)  
  Minimum characters inserted to consider as an accepted suggestion.
- `copilotTelegramAlert.minLines` (default: 2)  
  Minimum lines inserted to consider as an accepted suggestion.
- `copilotTelegramAlert.cooldownSeconds` (default: 45)  
  Cooldown to avoid spam.
- `copilotTelegramAlert.batchSeconds` (default: 5)  
  Number of seconds to batch file changes before sending a notification. Increase if you want to group more changes in a single alert.

## Packaging & Publish

- To create a `.vsix`:
  ```bash
  npm run package
  ```
- To publish to Marketplace:
  1. Create a publisher: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token
  2. Authenticate `vsce`: `vsce login <publisher>`
  3. Publish: `npm run publish`

## Limitations

- Pasting/typing a large block can trigger alerts. Adjust thresholds.
- This extension doesn’t read Copilot’s internal state—only buffer edits.

## License

MIT
