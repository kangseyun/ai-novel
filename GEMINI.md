# AI Novel Project Context

## Project Overview
**Goal:** Build a high-fidelity, interactive AI chat novel platform targeting 30-40s women ("Sophie" persona). The platform differentiates itself through "emotional intimacy," where AI characters remember user details (Memory System) and provide high-value locked content (Voice/Photos).

**Core Concept:** "The Romance Novel That Loves You Back."

## Technical Stack
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (v4)
- **Database:** Supabase (PostgreSQL)
- **Icons:** Lucide React
- **State/Data Fetching:** React 19 / Server Actions (Implied convention for Next 16)

## Key Documentation (`docs/`)
The `docs/` directory is the **Source of Truth** for the project's direction.
- `TARGET_PERSONA.md`: Defines "Sophie" (30-40s Female) and the "High LTV" strategy.
- `MVP_PLAN.md`: The development roadmap, including the "Memory System" and "Asset Lock" mechanics.
- `MARKETING_STRATEGY.md`: User acquisition strategy focused on "Emotional Hooks" via Meta/TikTok.

## Development Status
- **Current Phase:** Foundation / MVP Setup.
- **Implemented:**
    - Basic Next.js + Tailwind setup.
    - Basic Supabase client configuration.
    - Initial Type definitions (`types/index.ts`) - *Need update to support Memory/Assets.*
- **Immediate Next Steps:**
    - Refine Database Schema (Supabase) to support `memories`, `character_assets`, and `purchases`.
    - Implement the Chat Interface with "Hybrid" input (Choices + Text).

## Directory Structure
- `/app`: Next.js App Router pages.
    - `/novel`: Novel viewer/interaction interface.
    - `/studio`: (Planned) Admin/Creator interface for scripting scenarios.
- `/components`: React components (e.g., `ChatBubble`, `ChatViewer`).
- `/lib`: Utilities and Supabase client configuration.
- `/types`: TypeScript interfaces for the application data model.
- `/docs`: Strategic planning and requirement documents.

## Commands
- `npm run dev`: Start development server.
- `npm run build`: Build for production.
- `npm run lint`: Run ESLint.
