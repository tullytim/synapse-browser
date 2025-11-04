# Synapse Browser

An AI-powered web browser built with Electron that integrates Claude AI and Inception Labs Mercury for intelligent search, webpage summarization, smart bookmarking, and advanced privacy controls.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green.svg)
![Version](https://img.shields.io/badge/version-1.0.5-brightgreen.svg)
![Build Status](https://github.com/tullytim/synapse-browser/actions/workflows/build.yml/badge.svg)

## Features

### 🌐 Core Browsing
- **Tabbed browsing** with drag-and-drop tab reordering and tab context menus
- **Incognito mode** for private browsing sessions with visual indicators
- **Bookmarks bar** with drag-and-drop bookmark creation from address bar favicon
- **Tag-based bookmark filtering** - Filter bookmarks by AI-generated tags
- **History tracking** with search functionality and redirect chain tracking
- **Cookie management** with clear cookies/data options
- **Multiple navigation modes** per tab: Welcome screen, Web view, and Claude AI results
- **Session restoration** - Optionally restore all tabs from previous session on startup
- **Tab grouping** - Automatically group similar tabs together using AI
- **Downloads manager** with progress tracking and file management

### 🤖 AI-Powered Features
- **Claude AI Search** - Type natural language queries in the address bar to search with Claude or Inception
- **Dual address bars** - Separate Claude/Inception AI search and Google search bars
- **Page Summarization** - Single-page or multi-page summaries with AI
  - Single-page summary for current page analysis
  - Multi-page summary to analyze and synthesize content across multiple tabs
- **Smart Bookmarks** - Automatically generate tags and descriptions for bookmarks using AI
- **Ask About Page** - Ask specific questions about the current page content
- **Search Suggestions** - Get AI-powered search suggestions based on page content
- **Semantic Search** - Search content across all open tabs using natural language
- **Tab Grouping** - AI-powered grouping of similar tabs by topic or content
- **Multiple AI Models** - Choose between:
  - **Inception Labs Mercury** (Featured)
  - Claude Sonnet 4.5
  - Claude Haiku 4.5
  - Claude Opus 4.1
  - Claude Opus 4
  - Claude Sonnet 4
  - Claude 3.5 Haiku
  - Claude 3 Haiku
- **Autocomplete suggestions** - AI-powered search suggestions as you type

### 🎯 Automation & Productivity
- **Web Automation** - Record and playback browser workflows
  - Record user interactions (clicks, typing, navigation)
  - Save automations with custom names
  - Replay saved automations on demand
  - Manage saved automations (run or delete)
- **Screenshot capture** - Take screenshots of current page
- **Command palette** - Quick access via slash commands:
  - `/meet [emails]` - Create Google Meet and share with emails
  - `/zoom <topic> | <emails>` - Schedule Zoom meetings
  - `/calendar [event]` - Create Google Calendar events
  - `/weather [city]` - Get weather information
  - `/score [team/game]` - Look up sports scores
  - `/summary` - AI-powered page summary
  - `/tldr` - Concise 2-3 sentence summary
  - `/simplify` - Simplify page content for easier reading
  - `/extract <type>` - Extract media from pages
  - `/watch` - Monitor page for changes
  - And more extensible commands

### 🎨 User Experience
- **Clean, modern interface** inspired by Chrome with custom styling
- **Dark mode enforcer** - Force dark mode on any webpage automatically
- **Ad blocker** - Built-in ad blocking with network-level filtering
  - Toggle on/off from toolbar
  - Whitelist for specific sites (YouTube, LinkedIn, Google Workspace)
  - DOM-level cleanup for ads that get through
- **Tracker blocker** - Block tracking pixels, beacons, and analytics (NEW in 1.0.5)
  - Smart third-party detection blocks only cross-site trackers
  - Visit tracking domains directly without blocking (e.g., sentry.io, mixpanel.com)
  - Blocks Google Analytics, Facebook Pixel, marketing pixels, session recording
  - CAPTCHA-aware - never blocks reCAPTCHA, hCaptcha, Turnstile, etc.
  - Toggle on/off from toolbar
- **Keyboard shortcuts** for common actions (see Keyboard Shortcuts section)
- **Rich context menus** for:
  - Links (open in new tab/window, copy link, incognito options)
  - Images (save, copy, open in new tab)
  - Text selection (copy, search with Claude/Inception)
  - Page actions (back, forward, reload, view source, inspect)
  - Tabs (reload, duplicate, pin, mute, move to new window, close options)
  - URL bar (cut, copy, paste, delete)
- **Find in page** functionality (Cmd/Ctrl+F) with result navigation
- **Zoom controls** for accessibility (zoom in/out/reset)
- **Favicon support** with automatic favicon fetching and caching
- **Visual tab indicators** for incognito tabs
- **Drag-and-drop** bookmark creation from address bar
- **Settings dialog** with customization options
- **Onboarding tour** for new users to learn features

### 🔒 Privacy & Security
- **Anti-bot detection bypass** for better website compatibility
- **Tracker blocker** - Block third-party tracking pixels, beacons, and analytics
- **Ad blocker** - Network-level ad blocking
- **Incognito tabs** with isolated sessions and no history tracking
- **Clear browsing data** options in Settings
- **No telemetry** or user tracking
- **Secure API key storage** with in-app configuration
- **Cookie isolation** for incognito tabs
- **User agent customization** to avoid automation detection
- **WebGL fingerprinting protection**
- **Advanced bot detection evasion** for accessing protected sites

### 🛠️ Developer Features
- **DevTools access** (Cmd/Ctrl+Option/Alt+I) for debugging
- **View page source** from context menu
- **Inspect element** functionality
- **Console access** for debugging webviews
- **Development mode** with enhanced logging
- **Network request monitoring**

## Installation

### Prerequisites
- Node.js 16.0.0 or higher
- npm or yarn package manager
- Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))
- Inception Labs API key (optional, for Mercury model - get one at [inceptionlabs.ai](https://inceptionlabs.ai))

### Quick Start

1. Clone the repository:
```bash
git clone https://github.com/tullytim/synapse-browser.git
cd synapse-browser
```

2. Install dependencies:
```bash
npm install
```

3. Set your Anthropic API key:
```bash
export ANTHROPIC_API_KEY=your-api-key-here
```

Or add it to your `.bashrc`/`.zshrc`:
```bash
echo 'export ANTHROPIC_API_KEY=your-api-key-here' >> ~/.zshrc
source ~/.zshrc
```

4. Run the browser:
```bash
npm start
```

### Installing Pre-built App (macOS)

If you download a pre-built `.dmg` or `.app` and macOS says it's "damaged" or "can't be opened":

**Option 1: Remove quarantine attribute (Recommended)**
```bash
xattr -cr "/Applications/Synapse Browser.app"
```

**Option 2: Allow in System Preferences**
1. Try to open the app (it will fail)
2. Go to System Preferences → Security & Privacy → General
3. Click "Open Anyway" next to the Synapse Browser message

**Option 3: Disable Gatekeeper temporarily (Not recommended)**
```bash
sudo spctl --master-disable
# Open the app, then re-enable:
sudo spctl --master-enable
```

**Why does this happen?**
The app is not notarized by Apple. Notarization requires an Apple Developer account ($99/year). For development and personal use, the above workarounds are safe.

### Development Mode

Run with DevTools enabled:
```bash
npm run dev
```

## Building

### Build for Your Platform
Build a distributable application for your current platform:
```bash
npm run build-mac    # macOS (.dmg, .zip)
npm run build-win    # Windows (.exe, portable)
npm run build-linux  # Linux (.AppImage)
```

The built applications will be in the `dist` folder.

### Build All Platforms (macOS and Windows)
```bash
npm run build
```

### CI/CD with GitHub Actions

The repository includes automated builds via GitHub Actions:

**On every commit to `main`:**
- Builds for macOS, Windows, and Linux
- Uploads build artifacts for download
- Check the "Actions" tab in your GitHub repo

**On version tags (e.g., `v1.0.5`):**
- Creates a GitHub Release
- Attaches built binaries for all platforms
- Auto-generates release notes

**To create a release:**
```bash
git tag v1.0.5
git push origin v1.0.5
```

The workflow files are located in `.github/workflows/`:
- `build.yml` - Builds on every commit
- `release.yml` - Creates releases on version tags

### Code Signing & Notarization (macOS)

To enable automatic code signing and notarization in GitHub Actions, you need an Apple Developer account and the following secrets configured in your GitHub repository:

**Required Secrets:**

1. **`APPLE_CERTIFICATE`** - Base64 encoded .p12 certificate
   ```bash
   # Export your Developer ID Application certificate from Keychain as .p12
   # Then convert to base64:
   base64 -i Certificates.p12 | pbcopy
   ```

2. **`APPLE_CERTIFICATE_PASSWORD`** - Password for the .p12 certificate

3. **`KEYCHAIN_PASSWORD`** - Any random password (e.g., `$(uuidgen)`)

4. **`APPLE_ID`** - Your Apple ID email

5. **`APPLE_APP_SPECIFIC_PASSWORD`** - App-specific password for your Apple ID
   - Generate at: https://appleid.apple.com/account/manage
   - Under "Sign-In and Security" → "App-Specific Passwords"

6. **`APPLE_TEAM_ID`** - Your Apple Developer Team ID
   - Find at: https://developer.apple.com/account (Membership section)

**To add secrets:**
1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret listed above

**Without code signing:**
- The build will succeed but produce unsigned apps
- Users will need to use `xattr -cr` to run the app (see Installation section)

### Troubleshooting Windows Builds

If the Windows installer doesn't launch or seems to do nothing:

1. **Check Windows Defender/Antivirus:**
   - The unsigned installer may be quarantined
   - Check Windows Defender quarantine folder
   - Temporarily disable antivirus and try again

2. **Use the Portable version:**
   - Look for `Synapse Browser Setup 1.0.5.exe` (installer)
   - OR use `Synapse Browser 1.0.5.exe` (portable - no install needed)
   - The portable version doesn't require installation

3. **Run as Administrator:**
   - Right-click the installer
   - Select "Run as administrator"

4. **Check Event Viewer:**
   - Open Windows Event Viewer
   - Look under Windows Logs → Application
   - Check for any error messages from the installer

5. **Build locally to test:**
   ```bash
   npm run build-win
   # Check dist/ folder for generated files
   ```

## Usage

### Basic Navigation
- **New Tab**: Cmd/Ctrl + T
- **New Incognito Tab**: Cmd/Ctrl + Shift + N
- **Close Tab**: Cmd/Ctrl + W
- **Reopen Closed Tab**: Cmd/Ctrl + Shift + T
- **Next/Previous Tab**: Cmd/Ctrl + Tab / Cmd/Ctrl + Shift + Tab
- **Navigate**: Use back/forward buttons or Alt/Cmd + ← / →
- **Reload Page**: Cmd/Ctrl + R (force reload: Cmd/Ctrl + Shift + R)
- **Focus Address Bar**: Cmd/Ctrl + L

### AI Features
- **Claude/Inception Search**: Type a question or topic in the main address bar (anything that's not a URL)
- **Google Search**: Use the dedicated Google search bar for traditional web search
- **Summarize Page**:
  - Click "✨ Interact" → "📄 Summarize Current Page" for single-page summary
  - Click "✨ Interact" → "📚 Multi-Page Summary" to analyze multiple tabs at once
- **Ask About Page**: Click "✨ Interact" → "💬 Ask About Page" to query current page content
- **Smart Bookmark**: Click "🔖 Smart Bookmark" to save with AI-generated tags and description
- **Search Suggestions**: Click "✨ Interact" → "🔍 Search Suggestions" for AI-powered query ideas based on current page
- **Semantic Search**: Click "🔎 Search All Tabs" to search content across all open tabs
- **Tab Grouping**: Click "🗂️ Group Tabs" to automatically organize similar tabs together
- **Model Selection**: Use the "Model:" dropdown to select your preferred AI model (Inception Labs Mercury is featured at the top)

### Automation Features
- **Record Automation**:
  1. Click "🎯 Automations" → "📹 Record New Automation"
  2. Perform actions on the page (clicks, typing, navigation)
  3. Click "Stop Recording" when done
  4. Name and save your automation
- **Run Automation**: Click "🎯 Automations" → Select saved automation from menu
- **Delete Automation**: Hover over automation in menu and click the delete (×) button
- **Screenshot**: Click "📸 Screenshot" to capture the current page

### Command Palette
Type commands directly in the address bar (all commands start with `/`):

**AI & Content Commands:**
- `/summary` - Get an AI-powered summary of the current page
- `/tldr` - Get a concise 2-3 sentence summary of the current page
- `/simplify` - Simplify the current page content for easier reading
- `/extract <type>` - Extract media from current page (e.g., `/extract images`, `/extract videos`)

**Productivity Commands:**
- `/meet [emails]` - Create instant Google Meet and optionally share link with email addresses
  - Example: `/meet user@email.com, user2@email.com`
- `/zoom <topic> | <emails>` - Schedule a Zoom meeting with topic and participants
  - Example: `/zoom Team Standup | user@email.com, user2@email.com`
- `/calendar [event details]` - Create a Google Calendar event
- `/watch` - Monitor current page for changes and get notifications (run again to stop watching)
- `/weather [city]` - Get weather for your location or specified city
  - Example: `/weather Tokyo`
- `/score [team/game]` - Look up sports scores
  - Example: `/score Lakers`
- `/volume up|down` - Control system volume

**Help:**
- `/help` - Show command helper with all available commands

### Toolbar Controls
- **Dark Mode Toggle**: Force dark mode on any webpage (preserves images)
- **Ad Blocker Toggle**: Enable/disable ad blocking (on by default)
- **Tracker Blocker Toggle**: Enable/disable tracking pixel/beacon blocking (on by default)
- **Model Selector**: Choose which AI model to use for AI features

### Bookmarks
- **Create Bookmark**: Drag the favicon from address bar to bookmarks bar
- **Smart Bookmark**: Click "🔖 Smart Bookmark" for AI-enhanced bookmark with tags
- **Filter by Tag**: Use the tag filter dropdown to view bookmarks by category
- **Delete Bookmark**: Right-click bookmark and select delete
- **Edit Bookmark**: Right-click bookmark to edit title, URL, or tags

### Settings
- **Open Settings**: Click the gear icon (⚙) or press Cmd/Ctrl + ,
- **Set API Keys**:
  - Configure your Anthropic API key in Settings if not set via environment variable
  - Configure your Inception Labs API key for Mercury model access
- **Session Restoration**: Toggle "Restore tabs from previous session" to save/restore tabs
- **Privacy**: Toggle "Save browsing history" to control history tracking
- **Clear Data**: Clear cookies or all browsing data from Settings
- **Onboarding**: Reset the onboarding tour to see feature highlights again

### Context Menus
Right-click for context-sensitive actions:
- **On a link**: Open in new tab/window, copy link, open in incognito
- **On an image**: Save image, copy image, open in new tab
- **On selected text**: Copy, search with Claude
- **On a tab**: Reload, duplicate, pin, mute, move to new window, close options
- **On the page**: Back, forward, reload, view source, inspect element

### Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| New Tab | ⌘T | Ctrl+T |
| New Incognito Tab | ⌘⇧N | Ctrl+Shift+N |
| Close Tab | ⌘W | Ctrl+W |
| Reopen Closed Tab | ⌘⇧T | Ctrl+Shift+T |
| Find in Page | ⌘F | Ctrl+F |
| Reload | ⌘R | Ctrl+R |
| Force Reload | ⌘⇧R | Ctrl+Shift+R |
| Back | ⌘← | Alt+← |
| Forward | ⌘→ | Alt+→ |
| Focus Address Bar | ⌘L | Ctrl+L |
| Toggle DevTools | ⌘⌥I | Ctrl+Shift+I |
| Settings | ⌘, | Ctrl+, |
| Zoom In | ⌘+ | Ctrl++ |
| Zoom Out | ⌘- | Ctrl+- |
| Reset Zoom | ⌘0 | Ctrl+0 |

## Advanced Features

### Tracker Blocker (NEW in 1.0.5)
The tracker blocker intelligently blocks third-party tracking while preserving site functionality:

**What it blocks:**
- Third-party analytics (Google Analytics, Mixpanel, Amplitude, etc.)
- Marketing pixels (Facebook Pixel, Twitter, LinkedIn, Pinterest, etc.)
- Session recording tools (Hotjar, FullStory, LogRocket, etc.)
- Attribution tracking (Branch.io, AppsFlyer, Adjust, etc.)
- Heatmap services (Mouseflow, CrazyEgg, etc.)

**Smart features:**
- **Third-party detection**: Only blocks trackers loaded from other domains
- **Direct visit protection**: Visit tracking sites directly (e.g., sentry.io, segment.io)
- **CAPTCHA awareness**: Never blocks reCAPTCHA, hCaptcha, Turnstile, or bot detection
- **YouTube protection**: Preserves all YouTube functionality
- **Endpoint blocking**: Always blocks known tracking endpoints like /pixel.gif, /beacon/, /track

**Toggle on/off from the toolbar** - Track your privacy preferences

### Web Automation System
Synapse Browser includes a powerful automation recording and playback system:

**Recording Automations**:
- Records all user interactions including clicks, typing, scrolls, and navigation
- Captures XPath selectors for robust element targeting
- Handles dynamic content and page changes
- Supports multi-step workflows across multiple pages

**Playback Features**:
- Reliable element finding with multiple fallback strategies
- Automatic waiting for elements to appear
- Smart retry logic for dynamic content
- Progress tracking and error handling

**Use Cases**:
- Automate repetitive form filling
- Record testing scenarios
- Save common workflows
- Automate data entry tasks

### Dark Mode Enforcer
The dark mode feature applies a dark theme to any webpage:
- Converts backgrounds to dark (#1a1a1a) and text to light (#e0e0e0)
- Uses CSS color-scheme property for native dark mode hints
- Preserves image quality
- Works on sites without native dark mode
- Toggle on/off instantly from toolbar (page reload required)

### Multi-Page Summary
Analyze content across multiple tabs simultaneously:
- Select 2-10 recent tabs to summarize
- AI synthesizes information across all selected pages
- Perfect for research, comparison shopping, or news aggregation
- See preview of tabs before generating summary

### Semantic Search Across Tabs
Find information across all your open tabs:
- Natural language queries (e.g., "pricing information", "contact details")
- Searches page content, not just titles
- Returns relevant excerpts with tab context
- Click results to jump directly to the tab

## Testing

### Run All Tests
```bash
npm run test:all
```

### Run Specific Test Suites
```bash
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests with Playwright
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Project Structure

```
synapse-browser/
├── main.js                      # Main Electron process & API integration
├── renderer.js                  # Browser UI, tab management, and features
├── rpa-engine.js               # Web automation recording and playback engine
├── preload.js                  # IPC bridge between main and renderer
├── webview-preload.js          # Injected into webviews for automation
├── styles.css                  # Application styles and themes
├── index.html                  # Main application window structure
├── config.js                   # Configuration constants
├── ad-blocker-rules.js         # Ad blocking domain and pattern rules
├── tracker-blocker-rules.js    # Tracker blocking rules (NEW in 1.0.5)
├── automation-manager.js       # Automation workflow manager
├── computer-use.js             # Computer use API integration
├── package.json                # Project configuration and dependencies
├── build/                      # Build configuration files
│   ├── entitlements.mac.plist
│   └── notarize.js
├── assets/                     # Icons and static resources
│   ├── icon.ico
│   ├── icon.icns
│   └── icons/
├── tests/                      # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .github/workflows/          # CI/CD workflows
│   ├── build.yml
│   └── release.yml
└── README.md                   # This file
```

## Technologies

- **[Electron](https://www.electronjs.org/)** - Cross-platform desktop application framework
- **[Chromium](https://www.chromium.org/)** - Web rendering engine
- **[Anthropic Claude API](https://www.anthropic.com/)** - Primary AI capabilities
- **[Inception Labs Mercury](https://inceptionlabs.ai)** - Alternative AI model option
- **[Puppeteer](https://pptr.dev/)** - Browser automation
- **[Playwright](https://playwright.dev/)** - E2E testing framework
- **[Vitest](https://vitest.dev/)** - Unit and integration testing
- **Node.js** - JavaScript runtime
- **HTML/CSS/JavaScript** - Frontend technologies

## Development

### Running Tests
```bash
npm test
```

### Code Style
The project uses standard JavaScript style. Format code with:
```bash
npm run format
```

### Contributing
Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

### Debugging
- Open DevTools in the browser: Cmd/Ctrl + Option/Alt + I
- Check the console for errors
- Enable development mode for additional logging: `npm run dev`
- Use remote debugging port for webview inspection

## Known Issues

- Some websites may still detect automation despite anti-bot measures
- Video playback may require additional codecs on some Linux distributions
- Network-level blocking may need page reload to take effect

## Security Notice

**⚠️ Important**: Do not commit private keys, certificates, or API keys to version control. The repository includes `.gitignore` rules to prevent this, but always verify before committing:

```bash
# Check what you're about to commit
git status
git diff --cached
```

**Recommended practices:**
- Use environment variables for API keys
- Store certificates outside the repository
- Use GitHub Secrets for CI/CD credentials
- Review `.gitignore` regularly

## License

MIT License

Copyright (c) 2025 Tim Tully <tim@menlovc.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- AI powered by [Anthropic's Claude](https://www.anthropic.com/) and [Inception Labs Mercury](https://inceptionlabs.ai)
- Icons and design inspired by modern web browsers
- Testing powered by [Vitest](https://vitest.dev/) and [Playwright](https://playwright.dev/)

## Support

For issues, questions, or suggestions:
- Open an issue on [GitHub](https://github.com/tullytim/synapse-browser/issues)
- Contact: tim@menlovc.com

## Changelog

### Version 1.0.5 (Latest)
- ✨ **NEW**: Smart tracker blocker with third-party detection
- ✨ **NEW**: CAPTCHA-aware blocking (never blocks reCAPTCHA, hCaptcha, etc.)
- ✨ **NEW**: Comprehensive test suite with Vitest and Playwright
- 🔧 Improved privacy controls with separate ad and tracker blocking
- 🔧 Updated model selector with Mercury featured at top
- 📝 Enhanced documentation and security guidelines

### Previous Versions
See [GitHub Releases](https://github.com/tullytim/synapse-browser/releases) for full changelog.

---

**Note**: This is an experimental browser intended for development and educational purposes. Use at your own discretion for general web browsing.
