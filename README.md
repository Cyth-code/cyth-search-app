# Cyth Search App

AI-powered search across OneNote, Outlook & Teams — including text inside images.

## Features
- 📓 OneNote — all pages + Claude Vision OCR on images
- 📧 Outlook — last 500 emails
- 💬 Teams — channel messages + direct chats
- 🔍 Relevance-scored results with direct links back to source

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/YOUR-USERNAME/cyth-search-app.git
cd cyth-search-app
npm install
```

### 2. Create .env.local
```bash
cp .env.example .env.local
# Fill in your values
```

### 3. Run locally
```bash
npm run dev
# Open http://localhost:3000
```

## Deploy to Vercel
1. Import repo in vercel.com
2. Add all env variables from .env.example
3. Deploy

## Azure App Registration
Required API permissions (Delegated):
- Notes.Read, Notes.Read.All
- Mail.Read
- Chat.Read
- ChannelMessage.Read.All
- User.Read

Redirect URI: https://your-app.vercel.app/api/auth/callback/azure-ad
