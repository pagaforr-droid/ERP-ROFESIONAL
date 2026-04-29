-- Adding new columns to company_config for DNI/RUC API search

ALTER TABLE company_config
ADD COLUMN IF NOT EXISTS api_dni_ruc_url TEXT,
ADD COLUMN IF NOT EXISTS api_dni_ruc_token TEXT;
