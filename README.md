# LeadPilot AI v0.2

A real multi-tenant MVP for an AI sales assistant. It is designed to be customised and deployed, rather than being a static demo.

## What is real in this version

- Supabase authentication
- Multi-business database structure
- Business onboarding
- Configurable AI assistant per business
- Public assistant URL
- OpenAI Responses API integration
- Structured lead extraction and HOT/WARM/COLD scoring
- Conversation persistence
- Lead dashboard
- Lead status model
- Row Level Security for customer dashboard data

## Setup

1. Create a Supabase project.
2. Open Supabase SQL Editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL, publishable key, service role key and OpenAI API key.
4. Install dependencies with `npm install`.
5. Start with `npm run dev`.
6. Create an account at `/login` and complete onboarding.
7. Test the public assistant from the dashboard.

## Important

Keep `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` server-side only. Never expose them in browser code.

## Next production upgrades

- Email/SMS lead alerts
- Embedded website widget
- Custom domains
- Billing/subscriptions
- Team members and roles
- Knowledge base / document upload
- Human handoff
- Analytics and conversion reporting
- CRM integrations
- Voice assistant
