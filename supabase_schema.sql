-- Drop existing tables (safe to re-run)
drop table if exists meeting_items cascade;
drop table if exists project_tasks cascade;
drop table if exists meetings cascade;
drop table if exists projects cascade;
drop table if exists invoices cascade;
drop table if exists members cascade;

-- Recreate
create table projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now()
);

create table project_tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  status text default 'To Do',
  due_date date,
  done boolean default false,
  created_at timestamptz default now()
);

create table meetings (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  date date not null,
  created_at timestamptz default now()
);

create table meeting_items (
  id uuid default gen_random_uuid() primary key,
  meeting_id uuid references meetings(id) on delete cascade,
  name text not null,
  done boolean default false,
  has_timeline boolean default false,
  deadline date,
  created_at timestamptz default now()
);

create table invoices (
  id uuid default gen_random_uuid() primary key,
  recipient text not null,
  amount numeric not null,
  reason text,
  date date not null,
  status text default 'Pending',
  created_at timestamptz default now()
);

create table members (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text unique not null,
  role text default 'Member',
  join_date date default current_date,
  created_at timestamptz default now()
);
