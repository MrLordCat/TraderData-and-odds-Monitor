# Uptime Tracker Chrome Extension

A Chrome extension that tracks uptime for trading sessions on dataservices (DS) based on game phase changes and trading status.

## Features

- **Automatic Phase Detection**: Starts tracking when Phase changes from "Pre-Game" to "In-Play"
- **Trading Status Monitoring**: Tracks whether markets are "Trading" or "Suspended"
- **Smart Uptime Calculation**: Only counts time when markets are actively trading
- **End-Game Logic**: Excludes final suspension periods if the game ends while suspended
- **Real-time Display**: Shows uptime percentage and duration directly on the page
- **Persistent Storage**: Maintains tracking data across page refreshes

## How It Works

1. **Start Condition**: Tracking begins when the Phase element changes from "Pre-Game" to "In-Play"
2. **Uptime Counting**: Time is counted as "uptime" only when trading status is "Trading"
3. **Suspension Handling**: When status changes to "Suspended", the timer pauses
4. **End Condition**: Tracking stops when Phase changes to "Post-Game"
5. **Final Suspension Rule**: If the game ends while suspended, the final suspension period is excluded from uptime calculations

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the folder containing these extension files
5. The extension will be installed and ready to use

## Usage

1. Navigate to a DS page
2. The uptime tracker will automatically appear below the trading state container
3. The tracker shows:
   - **Uptime Percentage**: Percentage of time markets were available for trading
   - **Time Duration**: Total uptime in HH:MM:SS format
   - **Current Status**: Whether the tracker is active and current trading state
4. Use the browser extension popup to view detailed statistics and reset the tracker

## Hotkeys

- **Numpad -** : Decrease odd team 1 (click spinner-down)
- **Numpad +** : Decrease odd team 2 (click spinner-up)
- **Enter** : Commit prices

## Visual Indicators

- **Green background**: Markets are currently trading (counting uptime)
- **Yellow background**: Markets are suspended (timer paused)
- **Gray background**: Waiting for In-Play or monitoring

## Files Structure

- `manifest.json`: Extension configuration
- `content.js`: Main tracking logic and DOM manipulation
- `background.js`: Service worker for extension coordination
- `popup.html/js`: Extension popup interface
- `styles.css`: Styling for the uptime display

## Technical Details

The extension monitors:
- Phase changes via DOM observation of `.state-item .value.ng-binding` elements
- Trading status changes via class attribute monitoring on `.market` elements
- Specific class patterns: `flags-MarketTradingStatus-Trading` vs `flags-MarketTradingStatus-Suspended`

Data persistence is handled through Chrome's storage API, allowing the tracker to resume after page refreshes or browser restarts.

## Permissions

- `activeTab`: To interact with the current tab
- `storage`: To persist tracking data
- `host_permissions`: Access to DS (dataservices)
