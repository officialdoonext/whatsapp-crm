# WhatsApp CRM (wacrm) — Complete Feature Specification & Architecture Document

> **Comprehensive overview of all built-in modules, capabilities, integrations, and architectural features included in the wacrm platform.**

---

## Table of Contents
1. [Platform Overview & Core Architecture](#1-platform-overview--core-architecture)
2. [Shared WhatsApp Team Inbox](#2-shared-whatsapp-team-inbox)
3. [Contact & Audience Management (CRM)](#3-contact--audience-management-crm)
4. [Sales Pipelines & Kanban Deals](#4-sales-pipelines--kanban-deals)
5. [Broadcast Campaigns & Outbound Marketing](#5-broadcast-campaigns--outbound-marketing)
6. [Visual No-Code Automations Engine](#6-visual-no-code-automations-engine)
7. [WhatsApp Native Interactive Flows](#7-whatsapp-native-interactive-flows)
8. [AI Reply Assistant & Autonomous Bot](#8-ai-reply-assistant--autonomous-bot)
9. [WhatsApp Commerce, Catalog & Payments](#9-whatsapp-commerce-catalog--payments)
10. [Push Notifications, PWA & Mobile Support](#10-push-notifications-pwa--mobile-support)
11. [Team Accounts, Roles & Security](#11-team-accounts-roles--security)
12. [Public REST API, Webhooks & MCP Server](#12-public-rest-api-webhooks--mcp-server)
13. [High-Concurrency Background Worker & Queue](#13-high-concurrency-background-worker--queue)
14. [Internationalization & UI Customization](#14-internationalization--ui-customization)

---

## 1. Platform Overview & Core Architecture

`wacrm` is a self-hostable, enterprise-grade WhatsApp CRM and customer engagement platform built for multi-agent support teams, sales organizations, and automated business workflows.

### Modern Technical Stack
- **Web Framework**: [Next.js 16](https://nextjs.org) (App Router, React 19, Server Actions, TypeScript).
- **Styling & UI**: Tailwind CSS v4, Lucide Icons, Shadcn UI / Radix primitives, Sonner toasts.
- **Database & Realtime**: [Supabase](https://supabase.com) (PostgreSQL 15+, Supabase SSR Auth, Realtime WebSockets, Supabase Storage, Row-Level Security on every table).
- **Messaging Engine**: Official Meta WhatsApp Business Cloud API (Graph API v21.0+).
- **Background Worker**: Standalone Node.js worker runner (`src/workers/index.ts`) bundled with esbuild for isolated execution in Docker, VPS, or PaaS (Railway, Hostinger).
- **Data Protection**: AES-256-GCM symmetric encryption for WhatsApp tokens, Meta App secrets, AI API keys, and payment credentials.

```
                          ┌────────────────────────┐
                          │   Meta WhatsApp Cloud  │
                          └───────────┬────────────┘
                                      │ Webhooks & Graph API
                                      ▼
┌─────────────────┐       ┌────────────────────────┐       ┌─────────────────┐
│ Next.js App     │ ◄───► │ Supabase (PostgreSQL)  │ ◄───► │ Worker Engine   │
│ (Dashboard/API) │       │ Auth, DB, RLS, Storage │       │ (Queues/Jobs)   │
└─────────────────┘       └────────────────────────┘       └─────────────────┘
         ▲                                                          ▲
         │                                                          │
         └───────────── Firebase Cloud Messaging (FCM) ─────────────┘
                                      │
                                      ▼
                         Native Mobile App (menext)
```

---

## 2. Shared WhatsApp Team Inbox

A unified multi-agent shared inbox designed to let entire teams manage one or multiple WhatsApp Business phone numbers without message collisions or missing customer inquiries.

### Key Capabilities
- **Multi-Agent Collaboration**: Multiple team members can work on the same WhatsApp number simultaneously.
- **Smart Filtering & Inbox Views**:
  - `All`: Complete conversation history.
  - `Mine`: Conversations specifically assigned to the logged-in agent.
  - `Unassigned`: New or unhandled incoming conversations requiring attention.
  - `Closed`: Resolved conversations with one-click re-open.
- **Search & Filter**: Search conversations in real-time by contact name, phone number, tags, or message text.
- **Rich Message Composer**:
  - Full Unicode emoji support.
  - Attachments: Images, Videos, PDF Documents, Office files, Audio.
  - **In-Browser Voice Notes**: Built-in WebAssembly Opus recorder (`opus-recorder`) allowing agents to record and send WhatsApp native voice messages (`audio/ogg; codecs=opus`).
  - **Quoted Replies**: Swipe or click on any message to create context-aware quoted replies.
  - **WhatsApp Reactions**: React to customer messages with WhatsApp emojis (👍, ❤️, 😂, etc.).
  - **Quick Replies**: Canned response library accessible via slash shortcuts (`/`) or quick picker modal.
  - **Template Sender**: Meta pre-approved template picker with dynamic variable parameter substitution.
  - **Catalog Product Dispatch**: Send product cards and multi-product catalogs directly from the chat composer.
- **Permanent Media Mirroring**: Automatically downloads and mirrors inbound WhatsApp media into Supabase Storage, preventing Meta's 14-day temporary media expiration from breaking chat history.
- **Live Message Status Tracking**: Real-time delivery and read receipts (sent `✓`, delivered `✓✓`, read blue `✓✓`, failed `!`).
- **Live Team Presence & Typing Indicators**: Real-time display of which agents are currently viewing or typing in a conversation to eliminate duplicate replies.
- **Contact CRM Drawer**: Instant right-hand drawer showing contact details, assigned agent, custom attributes, tags, associated deals, and internal private team notes.

---

## 3. Contact & Audience Management (CRM)

A single source of truth for customer identities, contact attributes, and customer histories.

### Key Capabilities
- **E.164 Phone Normalization & Deduplication**: Automatic phone number formatting and duplicate prevention.
- **Dynamic Custom Fields**: Add custom fields (text, numbers, dates, dropdown options, URLs) without modifying database schemas.
- **Multi-Tagging System**: Organize contacts with color-coded tags for targeted messaging and workflow triggers.
- **Bulk CSV Import & Export**:
  - CSV parser with intelligent column matching (Name, Phone, Email, Tags, Custom Fields).
  - Configurable deduplication handling (overwrite, skip, or merge).
- **Full Activity Timeline**: Chronological log of conversations, incoming/outgoing messages, pipeline stage transitions, and automation events.
- **Internal Collaboration Notes**: Private team notes tied to contact profiles visible only to internal agents.

---

## 4. Sales Pipelines & Kanban Deals

Visual sales pipeline management directly integrated with customer WhatsApp chats.

### Key Capabilities
- **Interactive Drag-and-Drop Kanban Board**: Built with `@dnd-kit` for fluid stage transitions.
- **Customizable Stages & Pipelines**:
  - Create multiple pipelines for different business units (e.g., Sales, Onboarding, Support Escalations).
  - Define custom stages, probability percentages, and stage colors.
- **Direct Deal Creation**: Create deals straight from an active WhatsApp conversation or contact profile.
- **Multi-Currency Support**: Native handling for USD ($), EUR (€), GBP (£), INR (₹), BRL (R$), KRW (₩), and other global currencies.
- **Pipeline Metrics & Analytics**:
  - Total pipeline value.
  - Stage-by-stage conversion metrics.
  - Win/loss velocity and deal age tracking.

---

## 5. Broadcast Campaigns & Outbound Marketing

Deliver targeted WhatsApp template notifications and marketing announcements at scale while respecting Meta's messaging policies and rate limits.

### 4-Step Campaign Builder
1. **Choose Template**: Select an approved Meta template (Marketing, Utility, or Authentication).
2. **Select Audience**: Target contacts by specific tags, custom attributes, or upload an ad-hoc recipient CSV file.
3. **Personalize**: Map template variables (`{{1}}`, `{{2}}`, etc.) to contact properties (`First Name`, `Company`, `Order ID`, etc.) with fallback defaults.
4. **Schedule & Send**: Send immediately or schedule for future delivery.

### Operational Features
- **Asynchronous Queue Engine**: Bulk messages are ingested into database-backed job queues and dispatched safely to prevent Meta rate-limit blocks.
- **Real-Time Delivery Analytics**: Track total queued, sent, delivered, read, and failed counts as they happen.
- **Lifecycle Controls**: Pause running broadcasts, resume interrupted sends, and trigger one-click retries for failed recipients.

---

## 6. Visual No-Code Automations Engine

Create event-driven workflows and auto-responders using a flexible visual automation tree.

### Supported Triggers
- **New Inbound Message**: Fires on any incoming customer message.
- **First Inbound Message**: Welcome sequence trigger for first-time contacts.
- **Keyword Match**: Triggers on specific words or phrases (exact match, contains, regex).
- **New Contact Created**: Fires when a contact is added via UI, API, or CSV.
- **Conversation Assigned**: Executes when a conversation is assigned to an agent.
- **Tag Added**: Fires when a specific tag is attached to a contact.
- **Time-Based Delay**: Timed drip campaigns and delayed follow-ups.
- **Interactive Reply**: Triggered when a customer clicks a specific interactive button or list item.

### Supported Steps & Actions
- `send_message`: Send automated text messages.
- `send_buttons`: Send interactive quick-reply buttons (up to 3 buttons).
- `send_list`: Send interactive sectioned list menus.
- `send_template`: Send official Meta pre-approved templates with parameters.
- `add_tag` / `remove_tag`: Manage contact tags dynamically.
- `assign_conversation`: Assign to a specific agent or distribute via round-robin.
- `update_contact_field`: Set standard or custom contact attributes.
- `create_deal`: Automatically generate a pipeline deal based on customer actions.
- `wait`: Pause execution for specified minutes, hours, or days before the next step.
- `condition`: If/Else branching based on message text, contact fields, tags, or prior answers.
- `send_webhook`: Dispatch an external HTTP POST request with dynamic variables to external systems (Zapier, Make, n8n, CRM backend).
- `close_conversation`: Mark conversation as resolved/closed.

---

## 7. WhatsApp Native Interactive Flows

Design and run rich, multi-screen forms and interactive experiences directly inside WhatsApp without sending users to an external browser.

### Key Capabilities
- **Visual Node Canvas**: Visual drag-and-drop flow builder powered by `@xyflow/react` and `@dagrejs/dagre`.
- **Native Meta Flows Integration**: Integrates directly with Meta's official Flows API endpoint.
- **Form Screens & Component Library**:
  - Text inputs, numbers, emails.
  - Single-choice radio lists and multi-select dropdowns.
  - Date pickers and screen-to-screen navigation logic.
- **Validation Panel**: Real-time syntax and schema validation before publishing to Meta.
- **Analytics & Submissions**: View flow completion rates, drop-off screens, and inspect submitted user responses.

---

## 8. AI Reply Assistant & Autonomous Bot

Empower support agents with generative AI and deploy 24/7 automated customer service agents using your own AI provider keys.

### Core AI Capabilities
- **Bring-Your-Own-Key (BYOK) Encryption**: Store your API keys securely encrypted with AES-256-GCM. No per-seat AI markup.
- **Multi-Provider LLM Support**:
  - **Anthropic**: Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus.
  - **OpenAI**: GPT-4o, GPT-4o-mini, GPT-4-turbo.
  - **Google Gemini**: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0.
  - **OpenAI-Compatible**: Groq, Together AI, Mistral AI, Ollama, self-hosted LLMs.
- **Hybrid Knowledge Base (RAG)**:
  - Upload FAQs, product documentation, return policies, and pricing sheets.
  - Automated document chunking and indexing.
  - Hybrid retrieval combining PostgreSQL Full-Text Search with pgvector semantic vector embeddings.
- **In-Inbox Copilot**: Agents can click "Draft with AI" to generate accurate, context-aware reply drafts that can be edited before sending.
- **Autonomous Auto-Reply Bot**:
  - Automatically answers incoming messages using your Knowledge Base.
  - Configurable system prompts, brand tone, and guardrails.
  - **Loop Prevention**: Per-conversation turn limits to prevent runaway loops.
  - **Clean Human Handoff**: Automatically detects when a customer requests a human agent or expresses frustration, pausing the AI and assigning the conversation to an agent.
- **AI Playground & Telemetry**: Test prompts and knowledge retrieval live in the dashboard, and track token usage, costs, and response latency.

---

## 9. WhatsApp Commerce, Catalog & Payments

Turn WhatsApp conversations into sales channels with native product catalogs and multi-gateway payment processing.

### Key Capabilities
- **Meta Catalog Sync**: Synchronize products, descriptions, prices, stock, and media from Meta Commerce Manager.
- **In-Chat Product Cards**: Send single product highlights or multi-product catalog messages directly into the customer conversation.
- **WhatsApp Native Shopping Cart**: Receive and process in-chat shopping carts submitted by customers via Meta's `order_details` format.
- **Multi-Gateway Payment Orchestration**:
  - **Razorpay**: Generate Razorpay Payment Links with dynamic amounts, send them in chat, and automatically verify settlement via webhooks.
  - **Stripe**: Generate Stripe Checkout Sessions with automatic order status reconciliation.
  - **UPI Instant Pay (India)**: Generate dynamic `upi://pay` deep links and dynamic QR codes for frictionless mobile payments.
  - **Meta Pay**: Support for native in-chat WhatsApp payment checkout.
- **Orders Dashboard**: Filter orders by status (`pending`, `paid`, `cancelled`, `completed`), view items ordered, and monitor total commerce revenue metrics.

---

## 10. Push Notifications, PWA & Mobile Support

Keep your team responsive to new customer inquiries across desktop, mobile, and web.

### Key Capabilities
- **Firebase Cloud Messaging (FCM HTTP v1)**:
  - Native push notifications delivered to mobile apps (e.g. `menext` / Doonext mobile app).
  - Dispatched via both Next.js server actions and the standalone background worker.
  - Targets assigned agents with sound, badges, and deep-link metadata.
- **Progressive Web App (PWA)**:
  - Full PWA support with service worker (`sw.js`) and installable web app manifest.
  - Installable directly on Windows, macOS, Android, and iOS home screens.
- **Web Browser Push Notifications**: Native desktop browser notifications when new messages arrive or conversations are assigned.
- **In-App Notification Center**: Notification inbox in the dashboard header displaying unread alerts and real-time assignment changes.

---

## 11. Team Accounts, Roles & Security

Enterprise-ready access control and security primitives designed for team environments.

### Role-Based Access Control (RBAC)
| Role | Capabilities |
|---|---|
| **Owner** | Full system control, account billing, WhatsApp connection, API keys, ownership transfer, account deletion. |
| **Admin** | Manage team members, automations, templates, pipelines, catalogs, settings, and API keys. |
| **Agent** | View inbox, reply to conversations, manage contacts, create deals, launch broadcasts. |
| **Viewer** | Read-only access to conversations, contacts, pipelines, and dashboard reporting. |

### Security Primitives
- **Row-Level Security (RLS)**: Enforced on 100% of PostgreSQL tables in Supabase for strict multi-tenant isolation.
- **Cryptographic Encryption**: AES-256-GCM encryption for all sensitive secrets (WhatsApp Access Tokens, Webhook verification tokens, Meta secrets, payment keys).
- **HMAC Webhook Verification**: All incoming Meta webhooks are cryptographically validated against `X-Hub-Signature-256`.
- **Rate Limiting**: Built-in sliding-window rate limiters across auth, messaging, and API routes (`src/lib/rate-limit.ts`).
- **Team Invitations**: Secure tokenized email invites with configurable expiration.

---

## 12. Public REST API, Webhooks & MCP Server

Integrate and automate `wacrm` from your existing software stack and AI workflows.

### Public REST API (`/api/v1`)
- **API Key Authentication**: Scoped bearer tokens (`wacrm_live_...`) with SHA-256 storage (plain key shown only upon creation).
- **Granular Scopes**:
  - `messages:send` & `messages:read`
  - `contacts:read` & `contacts:write`
  - `conversations:read`
  - `broadcasts:send`
  - `webhooks:manage`
- **Key Endpoints**:
  - `/api/v1/me`: Validate key and inspect granted scopes.
  - `/api/v1/messages`: Send text, media, or template messages.
  - `/api/v1/contacts`: Query, create, or update contact records.
  - `/api/v1/conversations`: Fetch conversation threads and messages.
  - `/api/v1/broadcasts`: Trigger broadcast campaigns programmatically.

### Outbound Event Webhooks
- Subscribe to real-time CRM events: `message.received`, `message.sent`, `contact.created`, `deal.created`, etc.
- Delivered with HMAC SHA-256 signature verification headers to verify authenticity.

### Model Context Protocol (MCP) Server
- Included in `mcp-server/`.
- Connects your CRM directly to Claude Desktop, Cursor, and AI agents via the open Model Context Protocol.
- Read-only by default with opt-in write tools to query messages, look up contacts, and review pipeline deals using conversational AI.

---

## 13. High-Concurrency Background Worker & Queue

A resilient, scalable background task runner designed to handle heavy workloads independently of the Next.js web process.

### Architecture & Capabilities
- **Decoupled Architecture**: Bundled via esbuild (`dist/worker.mjs`) to run as a standalone process (`npm run worker`), in a dedicated Docker container, or on background platforms like Railway.
- **Database-Backed Job Queues**:
  - `outbound_message`: Reliable delivery of outgoing chat messages.
  - `broadcast_recipient`: Mass template sending with rate limiting and retry backoff.
  - `automation_trigger` & `delayed_automation_step`: Complex automation trees and delayed step executions.
  - `webhook_event`: Asynchronous processing of incoming Meta webhooks to avoid timeout drops.
  - `ai_auto_reply`: Background LLM generation and retrieval.
  - `media_mirror`: Streaming inbound media downloads to Supabase storage.
  - `inbound_push_notification`: FCM push delivery to mobile devices.
- **Structured Telemetry & Monitoring**: In-memory ring buffer recording throughput, latency (p95), errors, and queue depth.

---

## 14. Internationalization & UI Customization

Built for global teams with complete multilingual support and customizable appearance.

### Supported Locales
- **English** (`en`)
- **Spanish** (`es`)
- **Korean** (`ko`)
- **Brazilian Portuguese** (`pt`)

Configured via `NEXT_PUBLIC_APP_LOCALE` or user profile preference with complete message catalogues in `messages/`.

### Appearance
- **Themes**: Dark Mode, Light Mode, and System Theme sync.
- **Custom Branding**: Configurable brand logos, custom favicon, and app icons.

---

*Document compiled from the `wacrm` production codebase.*

