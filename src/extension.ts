import * as vscode from 'vscode';
import * as https from 'https';
import { URLSearchParams } from 'url';

interface CopilotTelegramAlertConfig {
  telegramBotToken: string;
  chatId: string;
  minChars: number;
  minLines: number;
  cooldownSeconds: number;
}

function sendTelegram(botToken: string, chatId: string, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!botToken || !chatId) {
      return reject(new Error('Configure the Telegram credentials'));
    }
    const data = new URLSearchParams({ chat_id: chatId, text });

    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data.toString())
        }
      },
      (res) => {
        const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
        if (ok) resolve();
        else reject(new Error(`Telegram status ${res.statusCode}`));
      }
    );

    req.on('error', reject);
    req.write(data.toString());
    req.end();
  });
}

let lastNotifyAt = 0;

const getBatchIntervalMs = () => {
  const config = vscode.workspace.getConfiguration('copilotTelegramAlert');
  return (config.get('batchSeconds', 5) || 5) * 1000;
};
let changedFilesBatch: Set<string> = new Set();
let batchTimeout: NodeJS.Timeout | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('🚀 Copilot Telegram Alert extension activated!');

  const cfg = () =>
    vscode.workspace.getConfiguration(
      'copilotTelegramAlert'
    ) as vscode.WorkspaceConfiguration & CopilotTelegramAlertConfig;

  context.subscriptions.push(
    vscode.commands.registerCommand('copilotTelegramAlert.ping', async () => {
      try {
        const { telegramBotToken, chatId } = cfg();
        await sendTelegram(telegramBotToken, chatId, 'Test ping from VS Code extension ✅');
        vscode.window.showInformationMessage('Ping sent to Telegram.');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        vscode.window.showErrorMessage(`Telegram ping failed: ${message}`);
      }
    })
  );

  let chatResponseStarted = false;

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      console.log('📝 Active editor changed:', editor?.document.uri.toString());
      if (editor?.document.uri.scheme === 'vscode-chat' || 
          editor?.document.fileName.includes('copilot-chat')) {
        console.log('💬 Chat context detected!');
        chatResponseStarted = true;
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (e) => {
      console.log('📄 Document changed:', {
        uri: e.document.uri.toString(),
        scheme: e.document.uri.scheme,
        fileName: e.document.fileName,
        first200: e.document.getText().slice(0, 200)
      });

      if (e.document.uri.scheme !== 'vscode-chat' && 
          !e.document.fileName.includes('copilot-chat') &&
          !e.document.uri.toString().includes('copilot')) {
        return;
      }

      console.log('🤖 Copilot document change detected!');

      const changes = e.contentChanges;
      if (changes.length === 0) return;

      console.log('📝 Number of changes:', changes.length);

      changes.forEach((change, idx) => {
        console.log(`📝 Change[${idx}]:`, {
          range: change.range,
          text: change.text.slice(0, 200)
        });
      });

      const lastChange = changes[changes.length - 1];
      const addedText = lastChange.text;

      console.log('➕ Added text:', JSON.stringify(addedText.slice(0, 100)));

      if (addedText.includes('```') || 
          addedText.endsWith('\n\n') || 
          addedText.match(/\.\s*$/)) {

        console.log('✅ Response completion detected!');

        const config = cfg();
        const { cooldownSeconds, telegramBotToken, chatId } = config;

        const now = Date.now();
        if ((now - lastNotifyAt) / 1000 < cooldownSeconds) {
          console.log('⏳ Cooldown active, skipping notification');
          return;
        }
        lastNotifyAt = now;

        if (!telegramBotToken || !chatId) {
          console.log('❌ Missing Telegram credentials');
          return;
        }

        const msg = 
          `🤖 Copilot Chat response completed!\n` +
          `• Time: ${new Date().toLocaleTimeString()}\n` +
          `• Ready for review`;

        console.log('📤 Sending Telegram message:', msg);

        try {
          await sendTelegram(telegramBotToken, chatId, msg);
          console.log('✅ Telegram message sent successfully!');
        } catch (err: unknown) {
          console.error('❌ Telegram error:', err);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (e) => {
      const changes = e.contentChanges;
      if (changes.length !== 1) return;
      const change = changes[0];
      const inserted = change.text;
      if (!inserted || inserted.trim().length === 0) return;

      const config = cfg();
      const { minChars, minLines, cooldownSeconds, telegramBotToken, chatId } = config;
      const numChars = inserted.length;
      const numLines = inserted.split(/\r?\n/).length;

      if (numChars < minChars && numLines < minLines) return;

      changedFilesBatch.add(e.document.fileName);

      if (batchTimeout) clearTimeout(batchTimeout);
      batchTimeout = setTimeout(async () => {
        if (!telegramBotToken || !chatId) return;
        const now = Date.now();
        if ((now - lastNotifyAt) / 1000 < cooldownSeconds) return;
        lastNotifyAt = now;
        const fileListArr = Array.from(changedFilesBatch).map(f => f.split(/[\/\\]/).pop() || f);
        const fileList = fileListArr.join(', ');
        const projectName = vscode.workspace.name || 'Unknown Project';
        const msg =
          `🚨 ${fileListArr.length} file(s) changed\n` +
          `• Project: ${projectName}\n` +
          `• Files: ${fileList}\n`;
        console.log('📤 Sending Telegram message:', msg);
        try {
          await sendTelegram(telegramBotToken, chatId, msg);
          console.log('✅ Telegram message sent successfully!');
        } catch (err: unknown) {
          console.error('❌ Telegram error:', err);
        }
        changedFilesBatch.clear();
        batchTimeout = null;
      }, getBatchIntervalMs());
    })
  );
}

export function deactivate() {}
