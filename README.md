# Playwright API Script Generator

A Visual Studio Code extension that automatically captures API requests and generates Playwright test scripts. This tool helps streamline the process of creating API tests by recording actual API calls made during application usage.

### Key Sections:
- **Troubleshooting**: The section that explains how to manually trigger the download of Chromium if the automatic download fails. This includes the `npx puppeteer browsers install chrome` command.

## Features

- 🎥 **API Request Capture**: Automatically captures API requests made from your application
- ✨ **Playwright Test Generation**: Converts captured API calls into Playwright test scripts
- 🎯 **Easy Configuration**: Simple setup for application and API base URLs
- 👀 **Visual Interface**: Dedicated sidebar view for managing captured APIs
- 🔄 **Start/Stop Controls**: Easily control when to capture API requests

## Usage

1. **Set Up URLs**:
   - Click the API Capture icon in the activity bar
   - Use "Set Application URL" to configure your application URL
   - Use "Set API Base URL" to configure your API base URL

2. **Start Capturing**:
   - Click "Start API Test" in the API Capture sidebar
   - Use your application as normal
   - API requests will be automatically captured

3. **Stop and Generate**:
   - Click "Stop API Test" when finished
   - View captured APIs in the sidebar
   - Generated Playwright tests will be available in your workspace

## Available Commands

The extension provides the following commands:

- `Start API Test`: Begin capturing API requests
- `Stop API Test`: Stop capturing API requests
- `Delete API Log`: Clear captured API logs
- `Set Application URL`: Configure the application URL
- `Set API Base URL`: Configure the API base URL

## Release Notes

### 0.0.1

Initial release of Playwright API Script Generator:
- Basic API request capture functionality
- Playwright test script generation
- Configuration options for URLs
- Sidebar view for captured APIs