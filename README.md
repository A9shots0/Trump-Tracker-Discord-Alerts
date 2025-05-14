# Trump Tracker Bot

A Discord bot that tracks and posts updates from Donald Trump's Truth Social account.

## Features

- Monitors Truth Social for new posts from @realDonaldTrump
- Posts updates to a specified Discord channel
- Beautiful Discord embeds with full post content and media

## Prerequisites

- Node.js 16 or higher
- Docker and Docker Compose (for running CouchDB)
- A Discord bot token
- A ScrapeCreators API key for Truth Social access

## Setup

1. Clone this repository
2. Copy `.env.example` to `.env` and fill in your configuration:
   - `DISCORD_TOKEN`: Your Discord bot token
   - `DISCORD_CHANNEL_ID`: The channel ID where updates should be posted
   - `SCRAPECREATORS_API_KEY`: Your ScrapeCreators API key (get one at https://scrapecreators.com)
   - `COUCHDB_*`: CouchDB configuration (defaults work with provided Docker setup)
   - `POLL_INTERVAL_MINUTES`: How often to check for new posts (default: 5)
   - `MAX_POST_AGE_HOURS`: Maximum age of posts to process (default: 24)

3. Start the database:
```bash
docker-compose up -d
```

4. Install dependencies:
```bash
npm install
```

5. Build the TypeScript code:
```bash
npm run build
```

6. Start the bot:
```bash
npm start
```

## Development

1. Install development dependencies:
```bash
npm install
```

2. Start in development mode (with auto-reload):
```bash
npm run dev
```

## Architecture

The bot consists of several services:

- `TruthSocialService`: Fetches posts from Truth Social using the ScrapeCreators API
- `DiscordClient`: Handles posting updates to Discord
- `DbService`: Manages state using CouchDB
- `Scheduler`: Coordinates polling of services

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT 