import * as vscode from 'vscode';
import * as https from 'https';
import { URLSearchParams } from 'url';

interface Config {
  telegramBotToken: string;
  chatId: string;
  cooldownSeconds: number;
  batchSeconds: number;
}

export class TelegramNotifier {
  private lastNotifyAt = 0;
  private changedFilesBatch = new Set<string>();
  private batchTimeout: NodeJS.Timeout | null = null;

  private getConfig(): Config {
    const config = vscode.workspace.getConfiguration('fidipides');
    return {
      telegramBotToken: config.get('telegramBotToken', ''),
      chatId: config.get('chatId', ''),
      cooldownSeconds: config.get('cooldownSeconds', 45),
      batchSeconds: config.get('batchSeconds', 30)
    };
  }

  private async sendMessage(text: string): Promise<void> {
    const { telegramBotToken, chatId } = this.getConfig();
    
    if (!telegramBotToken || !chatId) {
      throw new Error('Configure the telegram credentials');
    }

    const data = new URLSearchParams({ chat_id: chatId, text });

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.telegram.org',
          path: `/bot${telegramBotToken}/sendMessage`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(data.toString())
          }
        },
        (res) => {
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          if (ok) {
            resolve();
          } else {
            reject(new Error(`Telegram error: ${res.statusCode}`));
          }
        }
      );

      req.on('error', reject);
      req.write(data.toString());
      req.end();
    });
  }

  private canNotify(): boolean {
    const { cooldownSeconds } = this.getConfig();
    const now = Date.now();
    return (now - this.lastNotifyAt) / 1000 >= cooldownSeconds;
  }

  async sendTestPing(): Promise<void> {
    await this.sendMessage('Test ping from VS Code extension ✅');
  }

  async notifyCopilotResponse(): Promise<void> {
    if (!this.canNotify()) return;

    this.lastNotifyAt = Date.now();
    const message = 
      `🤖 Copilot Chat response completed!\n` +
      `• Time: ${new Date().toLocaleTimeString()}\n` +
      `• Ready for review`;

    await this.sendMessage(message);
  }

  addChangedFile(fileName: string): void {
    const { batchSeconds } = this.getConfig();
    this.changedFilesBatch.add(fileName);

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(async () => {
      if (this.canNotify() && this.changedFilesBatch.size > 0) {
        await this.sendBatchNotification();
      }
      this.changedFilesBatch.clear();
      this.batchTimeout = null;
    }, batchSeconds * 1000);
  }

  private async sendBatchNotification(): Promise<void> {
    this.lastNotifyAt = Date.now();
    const fileNames = Array.from(this.changedFilesBatch)
      .map(f => f.split(/[/\\]/).pop() || f);
    
    const projectName = vscode.workspace.name || 'Undefined';
    const message =
      `🚨 ${fileNames.length} file(s) changed\n` +
      `• Project: ${projectName}\n` +
      `• Files: ${fileNames.join(', ')}`;

    try {
      await this.sendMessage(message);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  const notifier = new TelegramNotifier();

  context.subscriptions.push(
    vscode.commands.registerCommand('fidipides.ping', async () => {
      try {
        await notifier.sendTestPing();
        vscode.window.showInformationMessage('Ping sent to Telegram.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Telegram ping failed: ${message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (e) => {
      if (isCopilotDocument(e.document)) {
        await handleCopilotResponse(e, notifier);
      } else {
        await handleRegularFileChange(e, notifier);
      }
    })
  );
}

export function isCopilotDocument(document: vscode.TextDocument): boolean {
  return document.uri.scheme === 'vscode-chat' ||
         document.fileName.includes('copilot-chat') ||
         document.uri.toString().includes('copilot');
}

async function handleCopilotResponse(
  e: vscode.TextDocumentChangeEvent,
  notifier: TelegramNotifier
): Promise<void> {
  const changes = e.contentChanges;
  if (changes.length === 0) return;

  const lastChange = changes[changes.length - 1];
  if (!lastChange) return;
  
  const addedText = lastChange.text;

  if (isResponseComplete(addedText)) {
    try {
      await notifier.notifyCopilotResponse();
    } catch (error) {
      console.error('Failed to send Copilot notification:', error);
    }
  }
}

export function isResponseComplete(text: string): boolean {
  return text.includes('```') || 
         text.endsWith('\n\n') || 
         /\.\s*$/.test(text);
}

async function handleRegularFileChange(
  e: vscode.TextDocumentChangeEvent,
  notifier: TelegramNotifier
): Promise<void> {
  const changes = e.contentChanges;
  if (changes.length !== 1) return;

  const change = changes[0];
  if (!change) return;
  
  const inserted = change.text;
  if (!inserted?.trim()) return;

  notifier.addChangedFile(e.document.fileName);
}

export function deactivate() {}
