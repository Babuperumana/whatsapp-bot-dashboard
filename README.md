# WhatsApp Bot — Full Feature Demo

A comprehensive WhatsApp bot built with [@kelvdra/baileys](https://github.com/kelvdra/baileys) featuring every message type, interactive messages, group management, and a real-time web dashboard.

## Features

### Message Types
- Text, Image, Video, GIF, Audio, Voice Note (PTT)
- Document, Location, Contact Card
- View-once, Disappearing messages
- Album (multi-image), Status/Story broadcast
- Event messages, Payment requests

### Interactive Messages
- Quick Reply Buttons
- Single-Select List Menu
- CTA URL Button, CTA Call Button, CTA Copy Button
- Buttons with Image
- Carousel Cards

### Polls
- Single-choice and multi-choice polls
- Real-time vote aggregation

### Group Management
- Create/leave groups, update subject/description
- Add/remove/promote/demote participants
- Get/revoke invite links, join by link
- Announcement mode, group lock, join approval, member add mode

### Other
- Message reactions, delete, edit, pin/unpin, forward
- Presence updates (typing indicator)
- Call handling (auto-reject optional)
- Privacy settings view
- Real-time web dashboard (Express + Socket.IO)

## Web Dashboard

Open `http://localhost:3000` after starting the bot to access:
- **Connect** tab — QR code scan, connection status, live message feed
- **Chats** tab — browse all chats and message history
- **Send Demo** tab — trigger any message type to any JID
- **Groups** tab — manage groups and members
- **Privacy** tab — view privacy settings
- **Logs** tab — real-time event stream

## Commands

Send any of these commands to the bot on WhatsApp:

| Command | Description |
|---------|-------------|
| `!ping` | Pong test |
| `!image` | Send image |
| `!video` | Send video |
| `!gif` | Send GIF |
| `!audio` | Send audio file |
| `!voice` | Send voice note (PTT) |
| `!doc` | Send PDF document |
| `!location` | Send location |
| `!contact` | Send contact card |
| `!poll` | Single-choice poll |
| `!multipoll` | Multi-choice poll |
| `!buttons` | Quick reply buttons |
| `!list` | Interactive list menu |
| `!urlbtn` | CTA URL button |
| `!callbtn` | CTA call button |
| `!copybtn` | CTA copy button |
| `!imgbtn` | Buttons with image |
| `!carousel` | Carousel cards |
| `!album` | Photo album |
| `!event` | Event message |
| `!react` | React 👍 to quoted message |
| `!delete` | Delete quoted message |
| `!edit <text>` | Edit quoted message |
| `!pin` | Pin quoted message |
| `!forward` | Forward quoted message |
| `!disappear on/off` | Toggle disappearing messages |
| `!groupinfo` | Group metadata (in group) |
| `!invite` | Get group invite link |
| `!promote @user` | Promote to admin |
| `!kick @user` | Remove member |
| `!privacy` | View privacy settings |
| `!help` | Show all commands |

## Setup

```bash
# Install dependencies
npm install

# Start the bot
npm start
```

Open `http://localhost:3000` and scan the QR code with WhatsApp.

## Tech Stack

- **[Baileys](https://github.com/kelvdra/baileys)** — WhatsApp Web multi-device library
- **Express.js** — HTTP server
- **Socket.IO** — Real-time web dashboard
- **Node.js** — ESM modules (`"type": "module"`)

## Project Structure

```
├── index.js                  # Main entry point
├── bot/
│   ├── connection.js         # WhatsApp socket setup & reconnect
│   ├── handlers/
│   │   ├── messages.js       # messages.upsert handler
│   │   ├── commands.js       # !command parser (30+ commands)
│   │   ├── calls.js          # Call event handler
│   │   └── presence.js       # Presence update handler
│   └── features/
│       ├── sendExamples.js   # Every message type as functions
│       ├── groupManager.js   # Group CRUD wrappers
│       ├── mediaHandler.js   # Media download & extraction
│       └── pollManager.js    # Poll vote aggregation
└── web/
    ├── server.js             # Express + Socket.IO server
    └── public/
        ├── index.html        # Single-page dashboard
        ├── style.css         # Dark theme CSS
        └── app.js            # Client-side Socket.IO logic
```
