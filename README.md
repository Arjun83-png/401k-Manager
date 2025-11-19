# 401(k) Contribution Manager

A single-page web application that lets a user:

- Choose **how** to contribute to their 401(k) (percentage of paycheck vs fixed dollar amount)
- See a **summary** of their per-paycheck contribution
- View **mock Year-to-Date (YTD) contribution data**
- See the **long-term impact** of saving an extra 1% toward retirement

Built with **React (Vite)** on the frontend and **Supabase (PostgreSQL + REST APIs)** as the backend.

---

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Supabase (PostgREST + Supabase JS client)
- **Database:** PostgreSQL (managed by Supabase)

The React app talks directly to Supabase via the official `@supabase/supabase-js` client. Supabase exposes a REST API for the `contribution_settings` table used to persist the user’s contribution choice.

---

## How to run the Application

Make sure you have:

- **Node.js**
- **npm** (comes with Node)
- A **Supabase account** and project (I used the free version)
- An IDE (I used VS Code)

---

## 1. Supabase Setup

### 1.1 Create a Supabase Project

1. Go to the Supabase dashboard and create a new project.
2. Once created, go to **Project Settings -> API** and note:
   - **Project URL**
   - **anon public key**

Plug these into the React app as environment variables.

---

### 1.2 Create the Database Table

In your Supabase project:

1. Go to **SQL Editor -> New Query**.
2. Paste and run the following SQL:

```sql
-- Table to store 401(k) contribution settings
create table if not exists contribution_settings (
  id bigint generated always as identity primary key,
  contribution_type text not null check (contribution_type in ('fixed', 'percentage')),
  contribution_value numeric(10,2) not null,
  created_at timestamptz not null default now()
);

-- Insert a default row for demo purposes
insert into contribution_settings (contribution_type, contribution_value)
values ('percentage', 5.00)
on conflict do nothing;
```

## Run Locally

1. Clone the github repository:
2. cd into 401k manager and run **npm install** and \*\*npm install @supabase/supabase-js
3. Create a file named **.env.local** in the root and paste your Supabase Project URL and ANON keys:

```
VITE_SUPABASE_URL = YOUR_SUPABASE_URL_HERE
VITE_SUPABASE_ANON_KEY = YOUR_SUPABASE_ANON_KEY_HERE
```

4. Finally run **npm run dev** and click on the local host link.
