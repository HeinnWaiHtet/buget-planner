## Income & Usage Tracker – Project Specification

### 1. Step-by-step Q&A Overview

**Q1. What is the main goal of this project?**  
A1. To build a household-focused income and expense tracker where members can record incomes and usages (expenses), classify each usage as **Need** or **Waste**, attach receipts, and analyze finances through reports and monthly budgets.

**Q2. Which platforms and technologies will be used?**  
A2. **Phase 1** is a **web app** built with **Next.js, React, TypeScript, Redux**, backed by **Supabase** (Postgres, Auth, RLS, Storage). **Phase 2** will add a **mobile app** using **React Native with Expo**.

**Q3. How will data be organized and secured?**  
A3. Data is organized around **households**. Each user belongs to a household, and RLS policies in Supabase ensure users can only access data for households they are members of. Admins (you) have elevated access, controlled via a profile flag.

**Q4. What are the core features for Phase 1?**  
A4. Phase 1 includes: user registration/login, household setup, income and usage CRUD, **Need/Waste** classification, customizable categories and payment methods, monthly budgets, basic reports and charts, PDF export, shareable read-only report links, and audit logging of key actions.

**Q5. How will we build this?**  
A5. First, we define and create the **database schema** in Supabase. Then we set up the Next.js app, integrate Supabase and Redux, implement the main flows (auth, incomes, usages, reports), wire up charts and PDF export, and finally add tests (unit, integration, E2E) around the critical flows.

---

### 2. Project Overview

- **Name**: (working title) **“Usage Balance”**  
- **Type**: Household income & usage tracker with Need/Waste analysis  
- **Currency & Locale**: Japanese Yen (JPY), English UI (initial)  
- **Backend**: Supabase (Postgres, Auth, RLS, Storage)  
- **Frontend (Phase 1)**: Next.js, React, TypeScript, Redux  
- **Mobile (Phase 2)**: React Native with Expo  

#### 2.1 Goals

- Track **income** (salary, bonus, other) for a shared household.
- Track **usage (expenses)** with categories, tags, payment methods.
- Enforce **Need vs Waste** classification on every usage.
- Attach optional **receipt/photos** to usages.
- Provide **reports**:
  - Total income vs total usage.
  - Breakdown by category.
  - Need vs waste comparison.
  - Trend over time (line charts).
- Support **monthly budgets** and show **under/over** status.
- Allow **read-only shareable links** to reports.
- Provide **audit logs** for changes.
- Enforce **row-level security** so each user only sees their household data.

#### 2.2 Non-goals (initial)

- Multiple currencies and localization.
- Complex financial/accounting features (loans, investments, double-entry).
- Advanced admin dashboards beyond basics.

---

### 3. Roles & Permissions

#### 3.1 Anonymous Visitor

- View landing/marketing content.
- View basic documentation/help.
- Cannot see or modify any user data.

#### 3.2 Member (Household Member)

- Authenticated user.
- Belongs to exactly one household (v1).
- Can:
  - Create/read/update/soft-delete **incomes** for household.
  - Create/read/update/soft-delete **usages** for household.
  - Manage household **categories**, **tags**, **payment methods**.
  - Configure **monthly budgets**.
  - View and export **reports**.
  - Upload **receipt images** for usages.

#### 3.3 Admin

- A user with `is_admin = true` in their profile.
- All Member permissions plus:
  - View and manage users and households (within admin UI).
  - Access broader **audit logs**.
  - Lock or deactivate accounts (Phase 1 or later).

---

### 4. Core User Flows

#### 4.1 Registration & Authentication

- **Sign up**
  - User enters email, password, display name.
  - Supabase creates auth user.
  - Backend creates:
    - `household` record.
    - `household_members` record with role `owner`.
    - `profile` record with `is_admin = false` (default).
  - Optional: email verification banner (actual “required” enforcement can be added later).

- **Login**
  - Email + password via Supabase.
  - Redirect to `/dashboard` after login.

- **Password Reset**
  - Supabase password reset flow.

#### 4.2 Household Management

- Each user has one auto-created household.
- Settings screen shows:
  - Household name (editable).
  - Currency (read-only JPY).
- Future: invite members to join household (Phase 2).

#### 4.3 Income Management

- **Create Income**
  - Fields:
    - Amount (JPY, positive).
    - Date (date).
    - Title (e.g. Salary, Bonus).
    - Description (optional).
    - Type: `salary | bonus | other`.
    - Source (optional text).
  - Linked to `household_id` and `created_by`.
  - Soft delete using `deleted_at`.

- **List & Edit**
  - Paginated list with date, title, amount, type.
  - Filter by date range and type.
  - Edit form reuses create form UI.

#### 4.4 Usage (Expense) Management

- **Create Usage**
  - Fields:
    - Amount (JPY, positive).
    - Date (date or datetime).
    - Category (required; selects from custom categories).
    - Optional subcategory/group behavior via category group.
    - Tags (zero or more; from tag suggestions or new).
    - Note (optional).
    - Payment method (required; from a list per household).
    - Need or Waste (required enum).
    - Optional receipt image (upload to Supabase Storage).

- **List & Filters**
  - Paginated, sortable list (by date, amount).
  - Filters:
    - Date range.
    - Category/group.
    - Need vs Waste.
    - Payment method.
    - Search text (note, title-equivalent, tags).

- **Edit & Delete**
  - Edit similar to create; changes recorded in audit log.
  - Soft delete via `deleted_at`.

#### 4.5 Categories, Tags, Payment Methods

- **Categories**
  - Two levels: `group_name` (e.g. Home, Food) + `name` (e.g. Groceries).
  - Predefined defaults inserted on first login.
  - Users can create/edit/delete categories and groups for their household.

- **Tags**
  - Simple tag objects per household.
  - `usage_tags` join table to attach many tags to a usage.

- **Payment Methods**
  - Per-household list (Cash, Card A, Card B, Bank Transfer, etc.).
  - Used both for entry and reporting.

#### 4.6 Budgeting

- **Monthly Budget**
  - For each household and month (YYYY-MM), user sets total budget.
  - App calculates:
    - Total usage for that month.
    - Status: under / on_track / over.
  - Possible extension: category/group-specific budgets later.

- **UI**
  - Budget card with:
    - Budget amount.
    - Spent amount.
    - Remaining amount.
    - Simple visual bar (progress).

#### 4.7 Reporting & Analytics

- **Time Range**
  - Custom start and end dates.
  - Quick filters for common ranges (this month, last month, etc.).

- **Income vs Usage Summary**
  - Shows:
    - Total income.
    - Total usage.
    - Net balance (income − usage).
  - Visual cards and simple chart.

- **Category Breakdown**
  - Aggregate usage by category or group.
  - Pie/bar chart of spending distribution.
  - Drill down group → categories.

- **Need vs Waste**
  - Need total, Waste total, Waste percentage.
  - Chart plus list of top Waste usages.

- **Trend Over Time**
  - Line chart of monthly income, usage, net, optionally color-coded by Need/Waste.

#### 4.8 Export & Sharing

- **Web View**
  - `/reports` route with all charts.

- **PDF Export**
  - User chooses date range and clicks “Export PDF”.
  - Next.js route or frontend library generates PDF with:
    - Date range, household name.
    - Summary stats.
    - Tables or summarized chart info.

- **Shareable Read-Only Link**
  - UI option: “Create shareable link”.
  - Generates token with:
    - Defined date range.
    - Expiry datetime.
  - Public route `/share/[token]` renders read-only report.
  - RLS + token checks restrict access to only that household and date range.

#### 4.9 Audit Logging

- Log on:
  - Income create/update/delete.
  - Usage create/update/delete.
  - Budget changes.
  - Category create/update/delete.
  - Login events (optional summary logs).
- Stored as JSONB old/new values and shown in admin/household history views.

---

### 5. Detailed Database Schema (Postgres / Supabase)

Below are **initial SQL-style definitions** for core tables. Types and constraints can be tweaked when applying in Supabase.

```sql
-- Profiles, linked to Supabase auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  enable row level security;

-- Households
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'JPY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.households
  enable row level security;

-- Household members (user <> household link)
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

alter table public.household_members
  enable row level security;

-- Incomes
create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  amount numeric(12, 2) not null check (amount > 0),
  date date not null,
  title text not null,
  description text,
  type text not null check (type in ('salary', 'bonus', 'other')),
  source text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index incomes_household_date_idx
  on public.incomes (household_id, date);

alter table public.incomes
  enable row level security;

-- Usage categories
create table public.usage_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  group_name text not null,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, group_name, name)
);

alter table public.usage_categories
  enable row level security;

-- Payment methods
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

alter table public.payment_methods
  enable row level security;

-- Tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

alter table public.tags
  enable row level security;

-- Usages (expenses)
create table public.usages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  amount numeric(12, 2) not null check (amount > 0),
  date timestamptz not null,
  category_id uuid not null references public.usage_categories (id),
  payment_method_id uuid not null references public.payment_methods (id),
  need_or_waste text not null check (need_or_waste in ('need', 'waste')),
  note text,
  attachment_url text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index usages_household_date_idx
  on public.usages (household_id, date);

alter table public.usages
  enable row level security;

-- Usage tags (many-to-many)
create table public.usage_tags (
  usage_id uuid not null references public.usages (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (usage_id, tag_id)
);

alter table public.usage_tags
  enable row level security;

-- Budgets (per month)
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  month text not null, -- format 'YYYY-MM'
  total_budget_amount numeric(12, 2) not null check (total_budget_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, month)
);

alter table public.budgets
  enable row level security;

-- Report share tokens
create table public.report_shares (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token text not null unique,
  date_from date not null,
  date_to date not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.report_shares
  enable row level security;

-- Audit logs
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid,
  user_id uuid references public.profiles (id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete', 'login')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs
  enable row level security;
```

> **Note**: In Supabase, you will also add **RLS policies** for each table to ensure that:
> - Users can only select/insert/update/delete rows for households where they are a member.
> - Admins (profiles.is_admin = true) have extended access as needed.

---

### 6. Phase 1 Implementation Plan

#### 6.1 Phase 1 – Setup & Backend

1. **Create Supabase project**
   - Create new project and connect SQL editor.
   - Configure environment variables for local dev (Next.js).
2. **Apply database schema**
   - Run the SQL from the “Detailed Database Schema” section.
   - Create necessary indexes if not already covered.
3. **Configure RLS & Policies**
   - Enable RLS (already done in schema above).
   - Add policies, for example:
     - `profiles`: user can select/update own profile; admins broader.
     - `households`, `household_members`, `incomes`, `usages`, etc.: user must be member of the household.
4. **Set up Storage**
   - Create `receipts` bucket.
   - Configure storage policies to allow:
     - Authenticated members of a household to upload and read only their household files.
5. **Seed default data**
   - Optional: SQL or RPC to insert default categories and payment methods for new households.

#### 6.2 Phase 1 – Web App Foundation (Next.js + Supabase + Redux)

1. **Bootstrap Next.js app**
   - Initialize Next.js with TypeScript.
   - Add ESLint/Prettier configuration.
2. **Install dependencies**
   - Supabase JS client.
   - Redux Toolkit, React-Redux.
   - UI library (e.g. Tailwind CSS, Headless UI).
   - Chart library (Recharts/Chart.js).
   - Testing libraries (Jest, React Testing Library, Playwright/Cypress).
3. **Configure Supabase client**
   - Add Supabase client initialization (environment-specific URLs/keys).
   - Provide context/hooks for auth and queries.
4. **Set up Redux**
   - Create slices for:
     - Auth/user profile.
     - UI (loading states, toasts).
     - Filter state for reports.

#### 6.3 Phase 1 – Auth & Household Flows

1. **Auth pages**
   - `/auth/login`, `/auth/register`, `/auth/reset`.
2. **Signup flow integration**
   - On successful auth sign-up, call backend logic to:
     - Create `profiles` row.
     - Create `households` row.
     - Create `household_members` row with owner role.
     - Insert default categories/payment methods.
3. **Session handling**
   - Maintain user session and redirect rules.
4. **Basic settings page**
   - Show/edit household name.

#### 6.4 Phase 1 – Income & Usage CRUD

1. **Income**
   - List page: table with filters (date range, type).
   - Add/edit modal or page.
   - Connect to Supabase CRUD.
2. **Usage**
   - List page: table with filters (date range, category, need/waste, payment method).
   - Add/edit modal with:
     - Need/Waste toggle.
     - Receipt upload hooked to storage.
   - Tagging UI (multi-select with free-create).

#### 6.5 Phase 1 – Budget & Reports

1. **Budget**
   - Settings section to configure monthly budget.
   - Backend queries to calculate monthly usage and budget status.
2. **Dashboard & Reports**
   - Dashboard summary cards:
     - Total income, usage, net, budget status.
   - `/reports` page:
     - Income vs usage chart.
     - Need vs waste chart.
     - Category breakdown chart.
     - Trend over time chart.
3. **PDF Export**
   - Implement PDF generation for current report filters.
   - Provide simple but clear layout.

#### 6.6 Phase 1 – Sharing & Audit Logs

1. **Shareable reports**
   - UI to create a share link with date range + expiry.
   - API/DB logic to insert into `report_shares`.
   - Public route `/share/[token]` to render read-only report.
2. **Audit logs**
   - Helper functions to write entries into `audit_logs` for key actions.
   - Simple admin/household history view (even if minimal at first).

#### 6.7 Phase 1 – Testing & Polish

1. **Unit tests**
   - For utility functions (budget calculations, aggregations).
2. **Component tests**
   - For major forms and toggles (Need/Waste, budget controls).
3. **E2E tests**
   - Basic flows: register → add income/usage → view report → export PDF.
4. **UI polish**
   - Make sure layout is responsive and clean.
   - Add basic accessibility improvements.

---

### 7. Phase 2 Preview (Mobile App with Expo)

- Build React Native app with Expo.
- Implement:
  - Login.
  - Quick add income/usage.
  - Photo capture for receipts.
  - Basic dashboard and key charts.
- Add offline support with local storage and sync with Supabase when online.

