-- Tablas para el módulo de Recursos Humanos y Planillas
CREATE TABLE IF NOT EXISTS erp_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dni VARCHAR(15) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    base_salary NUMERIC(10,2) NOT NULL DEFAULT 1025.00,
    payment_frequency VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    next_due_date DATE NOT NULL,
    legal_deduction_percent NUMERIC(5,2) NOT NULL DEFAULT 13.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erp_salary_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES erp_employees(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erp_payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES erp_employees(id) ON DELETE CASCADE,
    period VARCHAR(10) NOT NULL, -- e.g., "2026-03"
    base_amount NUMERIC(10,2) NOT NULL,
    legal_deductions NUMERIC(10,2) NOT NULL,
    advances_amount NUMERIC(10,2) NOT NULL,
    net_paid NUMERIC(10,2) NOT NULL,
    issue_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para el Control de Asistencia
CREATE TABLE IF NOT EXISTS erp_attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- Reference to erp_users.id
    date DATE NOT NULL,
    check_in TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out TIMESTAMP WITH TIME ZONE,
    photo_in TEXT, -- Base64 or URL
    photo_out TEXT,
    location_in_lat NUMERIC(10,7),
    location_in_lng NUMERIC(10,7),
    location_out_lat NUMERIC(10,7),
    location_out_lng NUMERIC(10,7),
    total_hours NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuraciones de seguridad básica (Políticas)
-- Para propósitos de este ERP, permitimos acceso anon/authenticated completo 
-- ya que la lógica asume que la autenticación está validada o se usa de manera interna.
ALTER TABLE erp_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read/write access for all users on erp_employees" ON erp_employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write access for all users on erp_salary_advances" ON erp_salary_advances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write access for all users on erp_payroll_records" ON erp_payroll_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write access for all users on erp_attendance_records" ON erp_attendance_records FOR ALL USING (true) WITH CHECK (true);
