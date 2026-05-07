-- ==============================================================================
-- Migración 27: Función RPC para Creación Segura de Usuarios Auth
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.create_erp_user_secure(
    p_email TEXT,
    p_password TEXT,
    p_name TEXT,
    p_role TEXT,
    p_permissions TEXT[],
    p_requires_attendance BOOLEAN,
    p_avatar_url TEXT
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_encrypted_password TEXT;
BEGIN
    -- 1. Verificar permisos (Solo ADMIN puede ejecutar esto)
    IF NOT EXISTS (
        SELECT 1 FROM public.erp_users 
        WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
    ) THEN
        RAISE EXCEPTION 'Acceso denegado. Solo los administradores pueden crear nuevos usuarios.';
    END IF;

    -- Verificar si el correo ya existe
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
        RAISE EXCEPTION 'El correo electrónico ya está registrado en el sistema.';
    END IF;

    -- 2. Generar UUID y encriptar contraseña
    v_user_id := gen_random_uuid();
    v_encrypted_password := crypt(p_password, gen_salt('bf'));

    -- 3. Insertar en auth.users (Mundo Secreto)
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, 
        email_confirmed_at, created_at, updated_at, 
        confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
        v_user_id, 
        '00000000-0000-0000-0000-000000000000', 
        'authenticated', 
        'authenticated', 
        p_email, 
        v_encrypted_password,
        now(), 
        now(), 
        now(),
        '', '', '', ''
    );

    -- 4. Insertar en auth.identities (Necesario para el inicio de sesión de GoTrue)
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        format('{"sub":"%s","email":"%s"}', v_user_id::text, p_email)::jsonb,
        'email',
        now(),
        now(),
        now()
    );

    -- 5. Insertar en public.erp_users (Mundo Público / ERP)
    INSERT INTO public.erp_users (
        id, username, name, role, permissions, is_active, 
        requires_attendance, avatar_url, created_at
    ) VALUES (
        v_user_id, p_email, p_name, p_role, p_permissions, true, 
        p_requires_attendance, p_avatar_url, now()
    );

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'message', 'Usuario creado y autenticado correctamente');
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error interno al crear usuario: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
