# LingoLink

## Overview
LingoLink is an Expo (React Native) mobile application with an Express.js backend. It appears to be a translation/language-related app using OpenAI for translation features.

## Project Architecture

### Frontend
- **Framework**: Expo (React Native) with expo-router for navigation
- **Entry**: `app/` directory (expo-router file-based routing)
- **Styling**: React Native StyleSheet
- **State Management**: @tanstack/react-query

### Backend
- **Framework**: Express.js with TypeScript
- **Entry**: `server/index.ts`
- **Database**: PostgreSQL via Drizzle ORM
- **AI Integration**: OpenAI via Replit AI Integrations (no API key needed)

### Shared
- **Schema**: `shared/schema.ts` - Drizzle ORM schema definitions
- **Models**: `shared/models/` - Additional model definitions

### Key Directories
```
app/              - Expo Router pages/screens
assets/           - Static assets (images, fonts)
components/       - Reusable React Native components
constants/        - App constants and configuration
lib/              - Client-side utilities
server/           - Express backend
  routes.ts       - API route definitions
  storage.ts      - Data storage layer
  translation.ts  - OpenAI translation logic
  socket.ts       - WebSocket functionality
  db.ts           - Database connection
  templates/      - Server templates
  replit_integrations/ - AI integration modules
shared/           - Shared code between client and server
  schema.ts       - Drizzle ORM schema
patches/          - Patch files for dependencies
scripts/          - Build scripts
```

### Database
- PostgreSQL (Neon-backed via Replit)
- ORM: Drizzle with drizzle-kit for migrations
- Config: `drizzle.config.ts`

### Workflows
- **Start Backend**: `npm run server:dev` - Runs Express server on port 5000
- **Start Frontend**: `npm run expo:dev` - Runs Expo dev server

### Integrations
- OpenAI via Replit AI Integrations (env vars: AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL)

## Recent Changes
- 2026-02-19: Initial import - installed npm packages, provisioned PostgreSQL database, pushed schema, configured OpenAI integration

## User Preferences
- None recorded yet
