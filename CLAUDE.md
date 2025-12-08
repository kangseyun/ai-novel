# AI Novel - Claude Code Guide

## Project Overview

AI Novel is a mobile-first AI character chat platform built with Next.js 15 (App Router). Users interact with AI personas through DM-style conversations, stories, and scenarios. The platform features a social media-like experience with feeds, profiles, and relationship progression systems.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Auth**: Supabase Auth (OAuth: Google, Discord)
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **LLM**: OpenRouter API (multi-model support)
- **Payments**: Stripe
- **Analytics**: Mixpanel, Firebase/GA4, Meta Pixel, Airbridge
- **Image Generation**: Kling AI
- **Voice**: ElevenLabs

## Quick Commands

```bash
# Development
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint check
```

## Supabase Configuration

**Project ID**: `zwoyfqsavcghftbmijdc`

Always use MCP Supabase tools for database operations:
- `mcp__supabase__apply_migration` - Apply new migrations
- `mcp__supabase__execute_sql` - Run SQL queries
- `mcp__supabase__list_tables` - View table structure
- `mcp__supabase__get_logs` - Debug issues

Do NOT use CLI commands like `npx supabase db push`.

## Project Structure

```
app/                      # Next.js App Router pages
├── (marketing)/          # Marketing/landing pages
├── admin/                # Admin dashboard
├── api/                  # API routes
├── auth/                 # Auth callback handling
├── dm/                   # Direct message routes
├── follow-personas/      # Initial persona follow page
├── login/                # Login page
├── onboarding/           # Onboarding flow
├── profile/              # Persona profiles
└── test/                 # Test pages

components/               # React components
├── admin/                # Admin UI components
├── analytics/            # Analytics dashboard
├── chat/                 # Chat bubble components
├── dm/                   # DM list components
├── feed/                 # Activity feed
├── modals/               # Modal dialogs
├── onboarding/           # Onboarding flow components
│   └── variants/         # A/B test variants
├── profile/              # Profile components
├── providers/            # Context providers
├── scenario/             # Scenario player components
├── seo/                  # SEO components (JsonLd)
├── settings/             # Settings modals
├── sns/                  # Social features (DM, Story, Profile)
├── tutorial/             # Tutorial system
└── ui/                   # Shadcn UI components

lib/
├── ai-agent/             # AI Agent System
│   ├── core/             # AI engine, LLM client, model selector
│   ├── memory/           # Semantic memory with embeddings
│   └── modules/          # Scenario, event trigger, relationship services
├── i18n/                 # Internationalization (ko, en)
├── relationship/         # Relationship progression system
├── stores/               # Zustand stores
│   ├── auth-store.ts     # Auth state
│   ├── feed-store.ts     # Feed state
│   ├── game-store.ts     # Game state
│   ├── hacker-store.ts   # Hacker mode state
│   ├── tutorial-store.ts # Tutorial state
│   └── user-persona-store.ts  # User-persona relationships
└── supabase.ts           # Supabase client

supabase/
└── migrations/           # SQL migrations (numbered 009-061+)
```

## Key Systems

### 1. Persona System

Personas are AI characters with distinct personalities. Core table: `persona_core`, exposed via `personas` view.

Key fields:
- `id`: Unique identifier (e.g., 'jun', 'daniel')
- `target_audience`: 'female' (여성향), 'male' (남성향), 'anime'
- `is_premium`: Premium unlock required
- `category`, `tags`: For filtering

### 2. User-Persona Relationships

Tracked in `user_persona_relationships` table:
- `is_unlocked`: Whether user has access
- `affection`: 0-100 affection points
- `relationship_stage`: 'stranger' → 'acquaintance' → 'friend' → 'close_friend' → 'romantic'

### 3. AI Agent Architecture

Located in `lib/ai-agent/`:
- **AIEngine** (`core/ai-agent.ts`): Main chat orchestrator
- **LLMClient** (`core/llm-client.ts`): OpenRouter API wrapper
- **ModelSelector** (`core/model-selector.ts`): Multi-model selection
- **MemoryService** (`memory/memory-service.ts`): Semantic memory with pgvector embeddings
- **ScenarioService** (`modules/scenario-service.ts`): Guided conversation scenarios
- **EventTriggerService** (`modules/event-trigger-service.ts`): Event-based triggers

### 4. Onboarding Flow

1. `/onboarding` - Scenario/story experience with persona
2. `/login` - OAuth signup (Google/Discord)
3. `/auth/callback` - Auth processing
4. `/follow-personas` - Select 5+ personas to follow
5. `/` - Main app (home feed)

### 5. Token Economy

- Users receive tokens (100 initial)
- Tokens consumed per message/action
- Premium subscriptions via Stripe

## Database Patterns

### Migrations

SQL migrations in `supabase/migrations/` numbered sequentially. Apply via:
- MCP Supabase tool with project ID
- `npx supabase db push`

### RLS (Row Level Security)

All tables use RLS. Common patterns:
```sql
-- User can only access own data
CREATE POLICY "Users can view own data"
  ON table_name FOR SELECT
  USING (auth.uid() = user_id);
```

### Views

The `personas` view combines `persona_core` with active filter. Always query `personas` view, not `persona_core` directly for user-facing features.

## API Patterns

### Route Handlers (`app/api/`)

Standard pattern:
```typescript
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const supabase = await createClient();
  // ... logic
  return NextResponse.json({ data });
}
```

### Client API Calls

Use direct `fetch()` for API calls:
```typescript
const res = await fetch('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

## Component Patterns

### Client Components

Always start with `'use client';` for interactive components.

### State Management

Use Zustand stores from `lib/stores/`:
```typescript
import { useAuthStore } from '@/lib/stores/auth-store';

const { user, isAuthenticated } = useAuthStore();
```

### Styling

- Tailwind CSS with dark theme (black backgrounds)
- Mobile-first: max-w-430px constraint
- Framer Motion for animations

## Environment Variables

Copy `.env.example` to `.env.local`. Required:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

## Important Notes

1. **Language**: UI text uses Korean (한국어) as default with i18n support
2. **Mobile-first**: All designs target mobile viewports (430px max)
3. **Dark theme**: Black backgrounds with white/gray text
4. **Path aliases**: Use `@/` for imports (e.g., `@/lib/stores`)
5. **Type safety**: Strict TypeScript - no implicit any
6. **No console.log in production**: Remove debug logs before commit

## Admin System

Admin dashboard at `/admin` for:
- User management
- Persona configuration
- Marketing project management
- Analytics
- Scenario/trigger configuration

Access requires admin role in users table.
