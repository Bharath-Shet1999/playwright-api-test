import * as vscode from 'vscode';
import puppeteer, { Browser, Page } from 'puppeteer';

export function activate(extensionContext: vscode.ExtensionContext) {
  const apiCaptureProvider = new ApiCaptureProvider();
  vscode.window.registerTreeDataProvider('apiCaptureView', apiCaptureProvider);

  // Register Start API Test command
  vscode.commands.registerCommand('extension.startApiTest', async () => {
    let siteUrl = apiCaptureProvider.getSiteUrl();
    let apiBaseUrl = apiCaptureProvider.getApiBaseUrl();

    // Prompt user for Site URL if not set
    if (!siteUrl) {
      siteUrl = await vscode.window.showInputBox({
        placeHolder: 'Enter the application URL to test (e.g., https://your-app-url.com)',
        prompt: 'Enter the URL of the application you want to test',
      });

      if (!siteUrl) {
        vscode.window.showErrorMessage('No application URL provided. Aborting API capture.');
        return;
      }

      apiCaptureProvider.setSiteUrl(siteUrl);
    }

    // Prompt user for API Base URL if not set
    if (!apiBaseUrl) {
      apiBaseUrl = await vscode.window.showInputBox({
        placeHolder: 'Enter the API Base URL to capture (e.g., https://api.your-app.com)',
        prompt: 'Enter the base URL of the API you want to capture',
      });

      if (!apiBaseUrl) {
        vscode.window.showErrorMessage('No API Base URL provided. Aborting API capture.');
        return;
      }

      apiCaptureProvider.setApiBaseUrl(apiBaseUrl);
    }

    vscode.window.showInformationMessage('Launching browser to capture API requests and responses...');
    apiCaptureProvider.startApiCapture(siteUrl, apiBaseUrl);
  });

  // Register Stop API Test command
  vscode.commands.registerCommand('extension.stopApiTest', async () => {
    await apiCaptureProvider.stopApiCapture();
  });

  // Register Delete API Log command
  vscode.commands.registerCommand('extension.deleteApiLog', (log: ApiLogItem) => {
    apiCaptureProvider.deleteLog(log);
  });

  // Register command to set Site URL
  extensionContext.subscriptions.push(
    vscode.commands.registerCommand('extension.setSiteUrl', async () => {
      const siteUrl = await vscode.window.showInputBox({
        placeHolder: 'Enter the application URL (e.g., https://your-app-url.com)',
        prompt: 'Set the URL of the application you want to test',
      });

      if (siteUrl) {
        apiCaptureProvider.setSiteUrl(siteUrl);
        vscode.window.showInformationMessage(`Application URL set to: ${siteUrl}`);
      }
    })
  );

  // Register command to set API Base URL
  extensionContext.subscriptions.push(
    vscode.commands.registerCommand('extension.setApiBaseUrl', async () => {
      const apiBaseUrl = await vscode.window.showInputBox({
        placeHolder: 'Enter the API Base URL (e.g., https://api.your-app.com)',
        prompt: 'Set the base URL of the API you want to capture',
      });

      if (apiBaseUrl) {
        apiCaptureProvider.setApiBaseUrl(apiBaseUrl);
        vscode.window.showInformationMessage(`API Base URL set to: ${apiBaseUrl}`);
      }
    })
  );
}

class ApiCaptureProvider implements vscode.TreeDataProvider<ApiLogItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ApiLogItem | undefined | void> =
    new vscode.EventEmitter<ApiLogItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ApiLogItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private logs: ApiLogItem[] = [];
  private siteUrl: string | undefined;
  private apiBaseUrl: string | undefined;
  private capturing: boolean = false;
  private browser: Browser | null = null;
  private apiLogs: any[] = [];

  // Getter and Setter for Site URL and API Base URL
  getSiteUrl() {
    return this.siteUrl;
  }

  getApiBaseUrl() {
    return this.apiBaseUrl;
  }

  setSiteUrl(url: string) {
    this.siteUrl = url;
  }

  setApiBaseUrl(url: string) {
    this.apiBaseUrl = url;
  }

  addLog(log: any) {
    const logItem = new ApiLogItem(log.url, log.method);
    this.logs.push(logItem);
    this._onDidChangeTreeData.fire();
  }

  deleteLog(log: ApiLogItem) {
    this.logs = this.logs.filter((item) => item !== log);
    this.apiLogs = this.apiLogs.filter((item) => item.url !== log.label);
    this._onDidChangeTreeData.fire();
  }

  async startApiCapture(siteUrl: string, apiBaseUrl: string) {
    this.siteUrl = siteUrl;
    this.apiBaseUrl = apiBaseUrl;

    this.browser = await puppeteer.launch({ 
      headless: false,
      args: ['--start-maximized'], // Maximizes the window on launch
      defaultViewport: null
    });
    const page: Page = await this.browser.newPage();

    this.apiLogs = [];

    // Set up request interception to capture network requests
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['xhr', 'fetch'].includes(request.resourceType()) && request.url().startsWith(apiBaseUrl)) {
        const log = {
          method: request.method(),
          url: request.url(),
          headers: request.headers(),
          body: request.postData(),
          response: null,
        };
        this.apiLogs.push(log);
        this.addLog(log);
      }
      request.continue();
    });

    page.on('close', async () => {
      await this.stopApiCapture();
    });

    page.on('response', async (response) => {
      const matchingLog = this.apiLogs.find((log) => log.url === response.url());
      if (matchingLog) {
        try {
          matchingLog.response = {
            status: response.status(),
            headers: response.headers(),
            body: await response.text(),
          };
        } catch (err) {
          console.error(`Error capturing response for ${response.url()}:`, err);
        }
      }
    });

    await page.goto(siteUrl);
  }

  async stopApiCapture() {
    if(this.apiLogs.length > 0){
      return;
    }
    const testScripts = this.apiLogs.map((log, index) => this.generatePlaywrightScript(log, index));
    const testScriptContent = testScripts.join('\n\n');

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('api-tests.spec.js'),
      filters: { JavaScript: ['js'] },
    });

    if (saveUri) {
      const fs = require('fs');
      fs.writeFileSync(saveUri.fsPath, testScriptContent);
      vscode.window.showInformationMessage(`Test scripts saved to ${saveUri.fsPath}`);
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.logs = [];
    this._onDidChangeTreeData.fire();
  }

  private generatePlaywrightScript(log: any, index: number): string {
    const responseValidation = log.response
      ? `expect(response.status()).toBe(${log.response.status});
         expect(await response.json()).toEqual(expect.objectContaining(${log.response.body}));`
      : '';

    return `test('API Test Case ${index + 1}', async ({ request }) => {
        const response = await request.${log.method.toLowerCase()}('${log.url}', {
          headers: ${JSON.stringify(log.headers, null, 2)},
          data: ${JSON.stringify(log.body, null, 2) || 'undefined'},
        });
        ${responseValidation}
      });
    `;
  }

  getTreeItem(element: ApiLogItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ApiLogItem[] {
    return this.logs;
  }
}

class ApiLogItem extends vscode.TreeItem {
  constructor(public readonly label: string, private readonly method: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = this.method;
    this.contextValue = 'apiLog';
    this.command = {
      command: 'extension.deleteApiLog',
      title: '',
      arguments: [this],
    };
  }

  iconPath = new vscode.ThemeIcon('trash');
}

export function deactivate() {}
