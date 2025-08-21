import * as https from 'https';

// Mock VS Code API before importing
const mockVscode = {
  workspace: {
    getConfiguration: jest.fn(),
    name: 'TestProject',
    onDidChangeTextDocument: jest.fn()
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  commands: {
    registerCommand: jest.fn()
  }
};

jest.mock('vscode', () => mockVscode, { virtual: true });
import * as vscode from 'vscode';
import { activate, deactivate, TelegramNotifier, isCopilotDocument, isResponseComplete } from '../extension';

// Mock https module
jest.mock('https');
const mockHttps = https as jest.Mocked<typeof https>;

// Mock URLSearchParams
jest.mock('url', () => ({
  URLSearchParams: jest.fn().mockImplementation(() => ({
    toString: () => 'mocked-url-params'
  }))
}));

describe('Extension', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock configuration
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          'telegramBotToken': 'test-token',
          'chatId': 'test-chat-id',
          'cooldownSeconds': 45,
          'batchSeconds': 5
        };
        return config[key as keyof typeof config] || defaultValue;
      })
    });
  });

  describe('activate', () => {
    it('should register commands and event listeners', () => {
      const mockContext = {
        subscriptions: []
      };

      activate(mockContext as any);

      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        'fidipides.ping',
        expect.any(Function)
      );
      expect(vscode.workspace.onDidChangeTextDocument).toHaveBeenCalledWith(
        expect.any(Function)
      );
      expect(mockContext.subscriptions).toHaveLength(2);
    });
  });

  describe('deactivate', () => {
    it('should not throw an error', () => {
      expect(() => deactivate()).not.toThrow();
    });
  });

  describe('TelegramNotifier', () => {
    let notifier: TelegramNotifier;

    beforeEach(() => {
      // Mock https.request
      const mockRequest = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };
      
      mockHttps.request.mockImplementation((options, callback) => {
        // Simulate successful response
        if (callback) {
          const mockResponse = {
            statusCode: 200
          };
          process.nextTick(() => (callback as any)(mockResponse));
        }
        return mockRequest as any;
      });

      notifier = new TelegramNotifier();
    });

    describe('sendTestPing', () => {
      it('should send a test message', async () => {
        await notifier.sendTestPing();

        expect(mockHttps.request).toHaveBeenCalledWith(
          expect.objectContaining({
            hostname: 'api.telegram.org',
            path: '/bottest-token/sendMessage',
            method: 'POST'
          }),
          expect.any(Function)
        );
      });

      it('should throw error when credentials are missing', async () => {
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
          get: jest.fn(() => '')
        });

        await expect(notifier.sendTestPing()).rejects.toThrow('Configure the telegram credentials');
      });
    });

    describe('cooldown functionality', () => {
      it('should respect cooldown period', async () => {
        // Set short cooldown for testing
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
          get: jest.fn((key: string, defaultValue?: any) => {
            if (key === 'cooldownSeconds') return 1;
            const config = {
              'telegramBotToken': 'test-token',
              'chatId': 'test-chat-id',
              'batchSeconds': 5
            };
            return config[key as keyof typeof config] || defaultValue;
          })
        });

        // First notification should go through
        await notifier.notifyCopilotResponse();
        expect(mockHttps.request).toHaveBeenCalledTimes(1);

        // Immediate second notification should be blocked
        await notifier.notifyCopilotResponse();
        expect(mockHttps.request).toHaveBeenCalledTimes(1);
      });
    });

    describe('file change batching', () => {
      it('should batch file changes', (done) => {
        // Set very short batch time for testing
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
          get: jest.fn((key: string, defaultValue?: any) => {
            if (key === 'batchSeconds') return 0.1; // 100ms
            const config = {
              'telegramBotToken': 'test-token',
              'chatId': 'test-chat-id',
              'cooldownSeconds': 0
            };
            return config[key as keyof typeof config] || defaultValue;
          })
        });

        notifier.addChangedFile('file1.ts');
        notifier.addChangedFile('file2.ts');

        // Wait for batch timeout
        setTimeout(() => {
          expect(mockHttps.request).toHaveBeenCalledTimes(1);
          done();
        }, 200);
      });
    });
  });

  describe('utility functions', () => {

    describe('isCopilotDocument', () => {
      it('should identify copilot documents by scheme', () => {
        const document = {
          uri: { scheme: 'vscode-chat', toString: () => 'vscode-chat://test' },
          fileName: 'test.txt'
        } as any;
        
        expect(isCopilotDocument(document)).toBe(true);
      });

      it('should identify copilot documents by filename', () => {
        const document = {
          uri: { scheme: 'file', toString: () => 'file://test' },
          fileName: '/path/to/copilot-chat.txt'
        } as any;
        
        expect(isCopilotDocument(document)).toBe(true);
      });

      it('should identify copilot documents by URI', () => {
        const document = {
          uri: { scheme: 'file', toString: () => 'file://path/copilot/test.txt' },
          fileName: 'test.txt'
        } as any;
        
        expect(isCopilotDocument(document)).toBe(true);
      });

      it('should return false for regular documents', () => {
        const document = {
          uri: { scheme: 'file', toString: () => 'file://test.txt' },
          fileName: 'test.txt'
        } as any;
        
        expect(isCopilotDocument(document)).toBe(false);
      });
    });

    describe('isResponseComplete', () => {
      it('should detect code blocks', () => {
        expect(isResponseComplete('Here is some code: ```')).toBe(true);
      });

      it('should detect double newlines', () => {
        expect(isResponseComplete('Some text\n\n')).toBe(true);
      });

      it('should detect sentence endings', () => {
        expect(isResponseComplete('This is a complete sentence.')).toBe(true);
        expect(isResponseComplete('This is a sentence. ')).toBe(true);
      });

      it('should return false for incomplete text', () => {
        expect(isResponseComplete('This is incomplete')).toBe(false);
        expect(isResponseComplete('No ending')).toBe(false);
      });
    });
  });
});