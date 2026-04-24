# MoneyTracker Enhancement Roadmap

> Comprehensive analysis of potential improvements, new features, and architectural enhancements based on a full codebase review.

---

## Executive Summary

MoneyTracker is already a **feature-rich, production-grade personal finance application**. It covers the vast majority of what users need: multi-account tracking, budgeting, investments, debts, goals, subscriptions, recurring transactions, couple sharing, gamification, CSV/PDF import, PWA support, and field-level encryption.

The highest-impact enhancements fall into three buckets:
1. **Intelligence** — AI/ML-powered insights, automation, and predictions
2. **Convenience** — Real-time sync, better search, bulk operations, reminders
3. **Scale** — Multi-currency improvements, multi-country tax, performance at scale

---

## 1. AI & Smart Automation (High Impact)

### 1.1 Smart Transaction Categorization
- **What**: Use a lightweight on-device or rule-based ML model to auto-categorize imported/entered transactions based on description patterns
- **Current gap**: Users manually categorize every transaction; CSV import maps columns but doesn't infer categories from descriptions
- **Implementation**: A simple Bayes classifier or keyword-rules engine (no heavy AI needed). Store `description → category` frequency per user and learn over time
- **Files to touch**: `src/actions/transactions.ts`, new `src/lib/auto-categorize.ts`

### 1.2 Anomaly Detection & Spending Alerts
- **What**: Flag unusual transactions (e.g., "You spent 3x your usual grocery amount this week")
- **Current gap**: Budget alerts exist, but no behavioral anomaly detection
- **Implementation**: Track rolling averages per category; flag deviations > 2 standard deviations
- **Files to touch**: `src/actions/insights.ts`, `src/components/dashboard/`

### 1.3 Receipt OCR (Image Upload)
- **What**: Allow users to snap a photo of a receipt; extract merchant, amount, date, and line items automatically
- **Current gap**: PDF parsing exists for bank statements, but no receipt image OCR
- **Implementation**: Use a free OCR API (Tesseract.js client-side, or a cloud API like Google Vision / OpenAI GPT-4o mini)
- **Files to touch**: New `src/lib/receipt-ocr.ts`, `src/components/quick-add-fab.tsx`

### 1.4 Natural Language Transaction Entry
- **What**: User types "Lunch at Starbucks $12.50 yesterday" and the app parses it into a transaction
- **Current gap**: All entries are form-based
- **Implementation**: A lightweight regex + date-fns parser, or a small LLM call for complex cases
- **Files to touch**: New component `src/components/nl-transaction-input.tsx`

### 1.5 Spending Forecast & Predictions
- **What**: Predict end-of-month balances based on recurring transactions + historical spending patterns
- **Current gap**: Net worth tracks history but doesn't project forward
- **Implementation**: Simple linear regression or moving averages on monthly category spend × scheduled recurring items
- **Files to touch**: `src/actions/dashboard.ts`, `src/components/charts/`

---

## 2. Bank Sync & Real-Time Data (High Impact)

### 2.1 Open Banking / Plaid / Salt Edge Integration
- **What**: Automatically pull transactions from real bank accounts instead of manual entry or CSV upload
- **Current gap**: 100% manual data entry or CSV/PDF import
- **Implementation**: Plaid (US/UK/EU), Salt Edge (global), or Singapore-specific APIs (SGFinDex)
- **Note**: This is a major feature requiring API keys, webhook handling, and compliance considerations
- **Files to touch**: New `src/lib/bank-sync/`, `src/actions/sync.ts`, new DB models for `BankConnection`, `SyncLog`

### 2.2 Investment Price Tracking
- **What**: Auto-update stock, crypto, ETF, and mutual fund prices via market data APIs
- **Current gap**: Investments are tracked at cost basis only; no live or daily price updates
- **Implementation**: Free APIs like Yahoo Finance (unofficial), CoinGecko (crypto), or Alpha Vantage
- **Files to touch**: `src/actions/investments.ts`, new `src/lib/market-data.ts`, cron job or on-demand fetch

### 2.3 Automatic Recurring Transaction Detection
- **What**: Scan transaction history and suggest "This looks like a monthly Netflix subscription. Create a recurring rule?"
- **Current gap**: Recurring rules must be created manually
- **Implementation**: Pattern detection on identical amounts + merchant names within ±3 days each month
- **Files to touch**: New `src/lib/recurring-detection.ts`, UI suggestion component

---

## 3. Notifications & Reminders (Medium-High Impact)

### 3.1 Push Notifications (Web Push API)
- **What**: Browser push notifications for bill due dates, budget overruns, goal milestones
- **Current gap**: Zero notification system beyond in-app toasts (Sonner)
- **Implementation**: Web Push API + service worker in `public/sw.js` + storing user subscription preferences
- **Files to touch**: `public/sw.js`, new `src/lib/notifications.ts`, `src/actions/subscriptions.ts` (trigger on due dates)

### 3.2 Email Reports & Alerts
- **What**: Weekly summary email ("You spent $X this week, $Y under budget") or monthly net-worth report
- **Current gap**: No email integration
- **Implementation**: Resend, SendGrid, or AWS SES. Weekly cron via Next.js `unstable_after` or a simple scheduled function
- **Files to touch**: New `src/lib/email.ts`, email templates in `src/components/email/`

### 3.3 Bill Due Date Calendar Sync (ICS/iCal Export)
- **What**: Export subscription due dates and recurring bills to Google/Apple Calendar
- **Current gap**: Calendar view exists in-app only
- **Implementation**: Generate `.ics` feed from an API route (`/api/calendar.ics`)
- **Files to touch**: New `src/app/api/calendar/route.ts`

---

## 4. Security & Access Control (Medium-High Impact)

### 4.1 Two-Factor Authentication (2FA / TOTP)
- **What**: TOTP-based 2FA using authenticator apps (Google Authenticator, Authy)
- **Current gap**: Password + OAuth only; no MFA
- **Implementation**: `speakeasy` or `otplib` library; add `totpSecret` to User model; backup codes
- **Files to touch**: `prisma/schema.prisma`, `src/lib/auth.ts`, `src/app/settings/`

### 4.2 Passkey / WebAuthn Support
- **What**: Passwordless login with Face ID / Touch ID / Windows Hello
- **Current gap**: Traditional passwords only
- **Implementation**: `@simplewebauthn/browser` and `@simplewebauthn/server`
- **Files to touch**: `src/lib/auth.ts`, login/settings pages

### 4.3 Audit Log
- **What**: Track every data mutation (who changed what and when) for security and accountability
- **Current gap**: No audit trail
- **Implementation**: New `AuditLog` table with `userId`, `action`, `entity`, `entityId`, `oldValue`, `newValue`, `createdAt`
- **Files to touch**: `prisma/schema.prisma`, middleware in server actions or Prisma middleware

### 4.4 Biometric App Lock (PWA)
- **What**: Lock the PWA with device biometrics when reopened
- **Current gap**: App relies solely on session cookie expiry
- **Implementation**: WebAuthn `userVerification` or a simple local PIN overlay for the PWA

---

## 5. Search, Discovery & UX (Medium Impact)

### 5.1 Global Full-Text Search
- **What**: Command-K style search across transactions, accounts, categories, tags, goals, investments
- **Current gap**: No search functionality visible in the codebase
- **Implementation**: `cmdk` is already installed! Use it with a fuzzy search across indexed user data, or PostgreSQL `tsvector` full-text search
- **Files to touch**: New `src/components/command-search.tsx`, `src/actions/search.ts`

### 5.2 Advanced Filters on Transactions
- **What**: Filter by date range, amount range, account, category, tag, description contains, has receipt
- **Current gap**: Basic listing inferred; no advanced filter UI
- **Implementation**: Expand the transactions page with a filter panel
- **Files to touch**: `src/app/transactions/page.tsx` / client component

### 5.3 Bulk Operations
- **What**: Select multiple transactions → delete, recategorize, retag, or merge in one action
- **Current gap**: Bulk delete may exist for imports, but not for general transaction management
- **Files to touch**: `src/app/transactions/page.tsx`, `src/actions/transactions.ts`

### 5.4 Keyboard Shortcuts
- **What**: `Cmd+K` search, `N` new transaction, `G` then `T` go to transactions, `/` focus search
- **Current gap**: No keyboard navigation
- **Implementation**: `useHotkeys` custom hook or a lightweight keyboard manager
- **Files to touch**: New `src/hooks/use-hotkeys.ts`

### 5.5 Data Table with Sorting/Pagination
- **What**: Virtualized, sortable tables for transactions, investments, etc. (critical at scale)
- **Current gap**: No virtualization; all data likely rendered at once
- **Implementation**: `@tanstack/react-table` + `@tanstack/react-virtual` for infinite scroll / pagination
- **Files to touch**: Reusable `src/components/data-table.tsx`

---

## 6. Financial Intelligence & Insights (Medium Impact)

### 6.1 Subscription Analysis
- **What**: Detect price increases in subscriptions, find duplicates ("You have both Netflix and Hulu"), calculate annual cost
- **Current gap**: Subscriptions are tracked but not analyzed
- **Implementation**: Aggregate subscription data in `src/actions/subscriptions.ts`, add analysis UI

### 6.2 Year-over-Year (YoY) & Trend Reports
- **What**: Compare December 2025 vs December 2026 spending; show 12-month rolling trends per category
- **Current gap**: Monthly and basic charts exist, but no YoY comparison
- **Files to touch**: `src/actions/reports.ts`, new chart components

### 6.3 Savings Rate Tracking Over Time
- **What**: Monthly savings rate % chart (income - expenses / income)
- **Current gap**: Achievement exists for 50% savings rate, but no ongoing tracking chart
- **Files to touch**: `src/actions/reports.ts`, `src/components/charts/`

### 6.4 Debt Payoff Optimizer
- **What**: Avalanche vs Snowball payoff strategy comparison with projected dates
- **Current gap**: Debts are tracked; no payoff strategy modeling
- **Implementation**: Simple calculator component with amortization logic
- **Files to touch**: `src/app/debts/page.tsx`, new `src/lib/debt-strategies.ts`

### 6.5 Net Worth Milestone Celebrations
- **What**: When net worth crosses $10k, $50k, $100k, etc., trigger a confetti celebration + achievement
- **Current gap**: `canvas-confetti` is installed but only used for achievements; net worth milestones aren't celebrated
- **Files to touch**: `src/actions/dashboard.ts`, `src/components/dashboard/`

---

## 7. Multi-Currency & Globalization (Medium Impact)

### 7.1 Real-Time Multi-Currency Dashboard
- **What**: Dashboard shows net worth in user's preferred currency, converting all accounts in real-time
- **Current gap**: Exchange rates exist but are limited to 3 fallback currencies; not deeply integrated into the dashboard
- **Implementation**: Cache rates in Redis/DB, convert all balances on dashboard load
- **Files to touch**: `src/actions/dashboard.ts`, `src/lib/exchange-rates.ts`

### 7.2 Multi-Country Tax Support
- **What**: Extend beyond Singapore (US, UK, AU, EU tax brackets and deductions)
- **Current gap**: Only `src/lib/sg-tax.ts` exists
- **Implementation**: Modular tax engines per country, selectable in settings
- **Files to touch**: New `src/lib/tax/us-tax.ts`, `src/lib/tax/uk-tax.ts`, etc.

### 7.3 Currency-Specific Accounts & Transfers
- **What**: Track foreign currency accounts with automatic conversion history. Record exchange rate at time of transfer
- **Current gap**: Currency field exists per entity but FX history on transfers is not tracked
- **Files to touch**: `prisma/schema.prisma` (add `exchangeRate` to Transaction for transfers), `src/actions/transactions.ts`

---

## 8. Social & Collaborative Features (Medium Impact)

### 8.1 Split Bills / Expense Sharing
- **What**: Split a transaction with friends/family, track who owes what, settle up
- **Current gap**: Partner view exists, but no ad-hoc expense splitting
- **Implementation**: New `ExpenseSplit` and `SplitParticipant` models, similar to Splitwise
- **Files to touch**: `prisma/schema.prisma`, new `src/app/splits/` route, `src/actions/splits.ts`

### 8.2 Family / Household Mode
- **What**: More than 2 people (couple) — full family budgeting with roles (parent, child, viewer)
- **Current gap**: Only 1:1 couple linking exists
- **Implementation**: Extend `CoupleLink` to a `Household` model with many members and role-based permissions

### 8.3 Shared Goals
- **What**: Both partners contribute to the same goal (e.g., "Vacation Fund") and see combined progress
- **Current gap**: Goals are per-user
- **Files to touch**: `prisma/schema.prisma`, `src/actions/goals.ts`

---

## 9. Data Portability & Backup (Lower-Medium Impact)

### 9.1 Scheduled Auto-Export (Email/Download)
- **What**: Monthly automatic backup emailed to user, or stored for download
- **Current gap**: Manual export only at `/export`
- **Implementation**: Cron job + email (or just generate and store in a temporary bucket)

### 9.2 JSON / QIF / OFX Export
- **What**: Export in formats compatible with Quicken, YNAB, or other finance software
- **Current gap**: CSV export only
- **Implementation**: OFX is XML-based and well-documented
- **Files to touch**: `src/actions/export.ts`

### 9.3 Data Import from Other Apps
- **What**: Import from YNAB, Mint (RIP), Monarch Money export formats
- **Current gap**: Generic CSV + specific bank PDFs only
- **Files to touch**: `src/lib/pdf-parser.ts` adjacent, `src/components/csv-import-dialog.tsx`

---

## 10. Performance & Technical Debt (Lower-Medium Impact)

### 10.1 Database Query Optimization
- **What**: Add indexes for common query patterns (transactions by user + date, net worth snapshots by user + date)
- **Current gap**: Prisma schema doesn't show explicit `@index` declarations (worth verifying)
- **Files to touch**: `prisma/schema.prisma`

### 10.2 Redis / Upstash for Rate Caching
- **What**: Exchange rates, session data, and dashboard aggregations cached in Redis instead of in-memory
- **Current gap**: Exchange rates use a Node.js `Map` (lost on serverless cold starts)
- **Files to touch**: `src/lib/exchange-rates.ts`, `src/lib/cache.ts`

### 10.3 Background Jobs Queue
- **What**: Use Inngest, BullMQ, or QStash for heavy operations (bulk import, report generation, email sending)
- **Current gap**: Everything is synchronous in server actions
- **Files to touch**: New `src/lib/jobs.ts`

### 10.4 Image Optimization for Receipts
- **What**: Compress and resize receipt images before upload (reduce storage)
- **Current gap**: No receipt upload system yet, but when added, this will matter
- **Files to touch**: New `src/lib/image-compress.ts`

### 10.5 Request Deduplication & Debouncing
- **What**: Prevent double-submitting transactions, debounce quick-add FAB clicks
- **Current gap**: Not explicitly handled in server actions
- **Files to touch**: React `useTransition` / `useActionState` patterns, server-side idempotency keys

---

## 11. Gamification Expansion (Lower Impact, High Delight)

### 11.1 Leaderboards (Anonymous / Friends)
- **What**: "You saved more than 78% of users this month" (percentile ranking)
- **Current gap**: Solo achievements only
- **Implementation**: Aggregate anonymized stats, show percentile

### 11.2 Badges for Specific Behaviors
- **What**: "No-Spend Weekend", "Vegetarian Week" (low grocery spending), "Investment Guru" (diversified portfolio)
- **Current gap**: 36 achievements exist; room for 50+ more niche ones
- **Files to touch**: `src/lib/achievements.ts`

### 11.3 Daily Challenges
- **What**: "Review 3 subscriptions today" → +15 XP
- **Current gap**: Static achievements only
- **Implementation**: Daily rotating challenge stored in user record or cookie

---

## 12. Mobile-Native Feel (Lower Impact)

### 12.1 Pull-to-Refresh
- **What**: Native-feeling pull-to-refresh on transaction lists and dashboard
- **Current gap**: No PTR implementation
- **Implementation**: `react-pull-to-refresh` or custom touch handler

### 12.2 Haptic Feedback
- **What**: Vibrate on transaction save, achievement unlock, budget exceeded
- **Current gap**: No vibration API usage
- **Implementation**: `navigator.vibrate()` for supported devices

### 12.3 Bottom Sheet Modals
- **What**: iOS-style bottom sheets for transaction detail, quick add, filters
- **Current gap**: Dialogs are centered modals
- **Implementation**: Framer Motion + `vaul` library (already popular with shadcn)

---

## Quick Wins (Implement This Week)

These require minimal architectural changes but deliver immediate value:

1. **Add `@index` to frequently queried fields** in `prisma/schema.prisma`
2. **Global Command-K Search** using already-installed `cmdk`
3. **Keyboard Shortcuts** for power users
4. **Net Worth Milestone Celebrations** using already-installed `canvas-confetti`
5. **Debt Payoff Calculator** (Avalanche vs Snowball) — pure UI + math, no schema changes
6. **Subscription Annual Cost Summary** — aggregate existing data
7. **Savings Rate Chart** — derive from existing income/expense data
8. **Expand fallback exchange rates** to 15+ currencies in `src/lib/exchange-rates.ts`
9. **Add more achievements** (especially for investments, subscriptions, and streaks)
10. **Advanced transaction filters** (date range, amount range, multi-select categories)

---

## Major Projects (Implement Over Months)

These require significant design, schema changes, and potentially external services:

1. **Bank Sync via Plaid / Open Banking**
2. **Receipt OCR with Image Upload**
3. **Web Push Notifications + Email Reports**
4. **2FA / Passkey Authentication**
5. **Real-Time Investment Price Tracking**
6. **Split Bills / Expense Sharing**
7. **Multi-Country Tax Engines**
8. **AI Smart Categorization**
9. **Background Job Queue for Heavy Operations**
10. **Full Audit Log System**

---

## Suggested Next Steps

1. **Prioritize** based on your target users (are they manual trackers who want automation, or power users who want analytics?)
2. **Pick 2-3 Quick Wins** to ship this week and gather feedback
3. **Validate demand** for Bank Sync before investing in Plaid integration (it requires compliance and ongoing costs)
4. **Consider AI features carefully** — lightweight rule-based systems often outperform LLMs for structured finance data and keep costs near zero
