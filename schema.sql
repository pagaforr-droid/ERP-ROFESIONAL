-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Products Table
create table products (
  id uuid default uuid_generate_v4() primary key,
  sku text unique not null,
  name text not null,
  description text,
  min_stock int default 10,
  price decimal(10,2) not null,
  image_url text, -- NEW
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- NEW: Promotions & Combos Tables
create table promotions (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text not null,
  value decimal(10,2) not null,
  product_ids text[], -- Array
  start_date date,
  end_date date,
  is_active boolean default true,
  channels text[], -- Array
  allowed_seller_ids text[], -- Array
  image_url text
);

create table combos (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  price decimal(10,2) not null,
  items jsonb, -- [{product_id, quantity, unit_type}]
  start_date date,
  end_date date,
  is_active boolean default true,
  channels text[], 
  allowed_seller_ids text[],
  image_url text
);

-- 2. Batches (Lotes) - CRITICAL for Traceability
create table batches (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id) on delete restrict not null,
  code text not null, -- e.g., "LOT-2023-001"
  quantity_initial int not null,
  quantity_current int not null check (quantity_current >= 0),
  cost decimal(10,2) not null, -- Cost per unit for this specific batch
  expiration_date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create index idx_batches_expiration on batches(expiration_date);
create index idx_batches_product on batches(product_id);

-- 3. Sales Header
create table sales (
  id uuid default uuid_generate_v4() primary key,
  client_name text not null,
  total decimal(10,2) not null,
  status text check (status in ('pending', 'completed', 'canceled')) default 'completed',
  dispatch_status text check (dispatch_status in ('pending', 'assigned', 'in_transit', 'delivered')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Sale Items (Line Items)
create table sale_items (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references sales(id) on delete cascade not null,
  product_id uuid references products(id) not null,
  quantity int not null,
  unit_price decimal(10,2) not null
);

-- 5. Sale Batch Allocations (The connection between Sales and Batches)
-- This table stores exactly which batch fulfilled which part of a sale item.
create table sale_batch_allocations (
  id uuid default uuid_generate_v4() primary key,
  sale_item_id uuid references sale_items(id) on delete cascade not null,
  batch_id uuid references batches(id) not null,
  quantity int not null
);

-- 6. Logistics: Vehicles
create table vehicles (
  id uuid default uuid_generate_v4() primary key,
  plate text unique not null,
  capacity_kg decimal(10,2),
  driver_name text,
  is_active boolean default true
);

-- 7. Logistics: Dispatch Sheets (Hojas de Ruta)
create table dispatch_sheets (
  id uuid default uuid_generate_v4() primary key,
  code serial,
  vehicle_id uuid references vehicles(id) not null,
  status text check (status in ('pending', 'in_transit', 'completed')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Dispatch - Sales Link (Many-to-Many)
create table dispatch_sales (
  dispatch_id uuid references dispatch_sheets(id) on delete cascade not null,
  sale_id uuid references sales(id) on delete restrict not null,
  primary key (dispatch_id, sale_id)
);

-- Row Level Security (RLS) policies would go here
alter table products enable row level security;
alter table batches enable row level security;
alter table sales enable row level security;

-- Example policy
-- create policy "Allow public read" on products for select using (true);
