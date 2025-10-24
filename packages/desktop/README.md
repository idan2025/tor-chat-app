# TOR Chat Desktop App

Cross-platform desktop application for TOR Chat built with Electron.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
npm start

# Package for distribution
npm run package

# Create installers
npm run make
```

## Building for Distribution

### Windows
```bash
npm run make -- --platform=win32
```

### macOS
```bash
npm run make -- --platform=darwin
```

### Linux
```bash
npm run make -- --platform=linux
```

## Environment Variables

Create a `.env` file:

```env
WEB_URL=http://localhost:5173
NODE_ENV=development
```

## Features

- Cross-platform (Windows, macOS, Linux)
- Native desktop notifications
- System tray integration
- Auto-updates support
- Embedded WebUI
