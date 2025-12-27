# Addons Development

This folder contains addon source code for development purposes.

## Structure

```
addons-dev/
├── power-towers/          # Power Towers TD game addon
│   ├── manifest.json      # Addon metadata
│   ├── index.js           # Main entry (optional)
│   └── modules/
│       └── game-panel/
│           └── index.js   # Sidebar module
└── README.md
```

## Creating a New Addon

1. Create a new folder: `addons-dev/your-addon-id/`
2. Add `manifest.json`:
```json
{
  "id": "your-addon-id",
  "name": "Your Addon Name",
  "version": "0.0.1",
  "description": "Description of your addon",
  "author": "Your Name",
  "main": "index.js",
  "sidebarModules": [
    {
      "path": "modules/panel/index.js",
      "id": "panel",
      "name": "Panel Name"
    }
  ]
}
```

3. Create your sidebar module (see `power-towers/modules/game-panel/index.js` for example)

## Building

Addons are automatically built when you push changes to `addons-dev/` folder.

Manual build:
1. Go to Actions → Build Addon
2. Click "Run workflow"
3. Enter addon ID (folder name)

## Testing Locally

Copy your addon folder to the app's addons directory:
- Windows: `%APPDATA%/odds-desktop/addons/`
- macOS: `~/Library/Application Support/odds-desktop/addons/`
- Linux: `~/.config/odds-desktop/addons/`

Then enable in Settings → Addons.

## Publishing

1. Update version in `manifest.json`
2. Commit and push to main branch
3. Workflow will create a GitHub release
4. Update `addon-registry.json` with new version and downloadUrl
