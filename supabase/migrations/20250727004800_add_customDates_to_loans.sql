-- Adiciona coluna customDates para armazenar datas customizadas de parcelas
ALTER TABLE loans ADD COLUMN customDates JSONB;
