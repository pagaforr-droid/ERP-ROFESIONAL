-- ========================================================================================
-- SCRIPT 13: ALTER QUOTAS PARA SOPORTAR CUOTAS DE EMPRESA
-- ========================================================================================
-- Este script modifica la tabla de cuotas para permitir que el seller_id sea nulo.
-- Un registro con seller_id nulo se interpretará como una meta global o de empresa.

ALTER TABLE quotas
ALTER COLUMN seller_id DROP NOT NULL;
