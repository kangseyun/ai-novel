-- Create a table for the waitlist
create table public.waitlist (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  source text -- e.g., 'tiktok_ad_1', 'meta_carousel_2' (for tracking marketing source)
);

-- Set up Row Level Security (RLS)
alter table public.waitlist enable row level security;

-- Allow public insert (anyone can sign up)
create policy "Enable insert for public" on public.waitlist
  for insert with check (true);

-- Only allow admins (service_role) to view emails
create policy "Enable select for admins only" on public.waitlist
  for select using (auth.role() = 'service_role');
