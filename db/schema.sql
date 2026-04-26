CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT,
  role TEXT,
  display_name TEXT,
  pin_label TEXT,
  pin_hash TEXT,
  must_rotate_pin BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  raw_input_text TEXT,
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  entered_late BOOLEAN DEFAULT FALSE,
  conflict_flag BOOLEAN DEFAULT FALSE
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_label TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_rotate_pin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  sku TEXT,
  unit TEXT,
  category TEXT,
  current_stock NUMERIC(12,2),
  reorder_level NUMERIC(12,2),
  unit_cost_kes NUMERIC(12,2),
  raw_input_text TEXT,
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  entered_late BOOLEAN DEFAULT FALSE,
  conflict_flag BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT,
  transaction_type TEXT,
  quantity NUMERIC(12,2),
  unit TEXT,
  unit_cost_kes NUMERIC(12,2),
  total_cost_kes NUMERIC(12,2),
  reference_type TEXT,
  reference_id BIGINT,
  meal_type TEXT,
  date_time TIMESTAMPTZ DEFAULT NOW(),
  raw_input_text TEXT,
  notes TEXT,
  source_channel TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  entered_late BOOLEAN DEFAULT FALSE,
  conflict_flag BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS issue_logs (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT,
  item_name_snapshot TEXT,
  quantity NUMERIC(12,2),
  unit TEXT,
  raw_input_text TEXT,
  meal_type TEXT,
  date_time TIMESTAMPTZ DEFAULT NOW(),
  expected_students NUMERIC(10,2),
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  entered_late BOOLEAN DEFAULT FALSE,
  conflict_flag BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS leftover_logs (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT,
  item_name_snapshot TEXT,
  quantity NUMERIC(12,2),
  unit TEXT,
  raw_input_text TEXT,
  meal_type TEXT,
  date_time TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  entered_late BOOLEAN DEFAULT FALSE,
  conflict_flag BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS stock_counts (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT,
  counted_quantity NUMERIC(12,2),
  system_quantity NUMERIC(12,2),
  variance_quantity NUMERIC(12,2),
  unit TEXT,
  raw_input_text TEXT,
  meal_type TEXT,
  date_time TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  entered_late BOOLEAN DEFAULT FALSE,
  conflict_flag BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  alert_type TEXT,
  severity TEXT,
  title TEXT,
  message TEXT,
  item_id BIGINT,
  meal_type TEXT,
  status TEXT DEFAULT 'OPEN',
  source_record_type TEXT,
  source_record_id BIGINT,
  date_time TIMESTAMPTZ DEFAULT NOW(),
  raw_input_text TEXT,
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  entered_late BOOLEAN DEFAULT FALSE,
  conflict_flag BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cost_tracking (
  id BIGSERIAL PRIMARY KEY,
  report_date DATE,
  date_time TIMESTAMPTZ DEFAULT NOW(),
  meal_type TEXT,
  item_id BIGINT,
  quantity_used NUMERIC(12,2),
  unit_cost_kes NUMERIC(12,2),
  total_cost_kes NUMERIC(12,2),
  budget_kes NUMERIC(12,2),
  variance_kes NUMERIC(12,2),
  raw_input_text TEXT,
  source TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  entered_late BOOLEAN DEFAULT FALSE,
  conflict_flag BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS expected_usage (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT,
  meal_type TEXT,
  usage_date DATE,
  date_time TIMESTAMPTZ DEFAULT NOW(),
  expected_quantity NUMERIC(12,2),
  unit TEXT,
  expected_students NUMERIC(10,2),
  basis TEXT,
  raw_input_text TEXT,
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  entered_late BOOLEAN DEFAULT FALSE,
  conflict_flag BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS student_counts (
  id BIGSERIAL PRIMARY KEY,
  count_date DATE,
  date_time TIMESTAMPTZ DEFAULT NOW(),
  meal_type TEXT,
  student_count NUMERIC(10,2),
  raw_input_text TEXT,
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  entered_late BOOLEAN DEFAULT FALSE,
  conflict_flag BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT,
  actor_role TEXT,
  action_type TEXT,
  target_table TEXT,
  target_id BIGINT,
  status TEXT,
  payload JSONB,
  warnings JSONB,
  date_time TIMESTAMPTZ DEFAULT NOW(),
  raw_input_text TEXT,
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  entered_late BOOLEAN DEFAULT FALSE,
  conflict_flag BOOLEAN DEFAULT FALSE
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_users ON users;
CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_inventory_items ON inventory_items;
CREATE TRIGGER set_updated_at_inventory_items BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_stock_transactions ON stock_transactions;
CREATE TRIGGER set_updated_at_stock_transactions BEFORE UPDATE ON stock_transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_issue_logs ON issue_logs;
CREATE TRIGGER set_updated_at_issue_logs BEFORE UPDATE ON issue_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_leftover_logs ON leftover_logs;
CREATE TRIGGER set_updated_at_leftover_logs BEFORE UPDATE ON leftover_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_stock_counts ON stock_counts;
CREATE TRIGGER set_updated_at_stock_counts BEFORE UPDATE ON stock_counts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_alerts ON alerts;
CREATE TRIGGER set_updated_at_alerts BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_cost_tracking ON cost_tracking;
CREATE TRIGGER set_updated_at_cost_tracking BEFORE UPDATE ON cost_tracking FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_expected_usage ON expected_usage;
CREATE TRIGGER set_updated_at_expected_usage BEFORE UPDATE ON expected_usage FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_student_counts ON student_counts;
CREATE TRIGGER set_updated_at_student_counts BEFORE UPDATE ON student_counts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_activity_logs ON activity_logs;
CREATE TRIGGER set_updated_at_activity_logs BEFORE UPDATE ON activity_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_stock_transactions_item_id ON stock_transactions (item_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_date_time ON stock_transactions (date_time);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_meal_type ON stock_transactions (meal_type);
CREATE INDEX IF NOT EXISTS idx_issue_logs_item_id ON issue_logs (item_id);
CREATE INDEX IF NOT EXISTS idx_issue_logs_date_time ON issue_logs (date_time);
CREATE INDEX IF NOT EXISTS idx_issue_logs_meal_type ON issue_logs (meal_type);
CREATE INDEX IF NOT EXISTS idx_leftover_logs_item_id ON leftover_logs (item_id);
CREATE INDEX IF NOT EXISTS idx_leftover_logs_date_time ON leftover_logs (date_time);
CREATE INDEX IF NOT EXISTS idx_leftover_logs_meal_type ON leftover_logs (meal_type);
CREATE INDEX IF NOT EXISTS idx_stock_counts_item_id ON stock_counts (item_id);
CREATE INDEX IF NOT EXISTS idx_stock_counts_date_time ON stock_counts (date_time);
CREATE INDEX IF NOT EXISTS idx_stock_counts_meal_type ON stock_counts (meal_type);
CREATE INDEX IF NOT EXISTS idx_alerts_item_id ON alerts (item_id);
CREATE INDEX IF NOT EXISTS idx_alerts_date_time ON alerts (date_time);
CREATE INDEX IF NOT EXISTS idx_alerts_meal_type ON alerts (meal_type);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_item_id ON cost_tracking (item_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_date_time ON cost_tracking (date_time);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_meal_type ON cost_tracking (meal_type);
CREATE INDEX IF NOT EXISTS idx_expected_usage_item_id ON expected_usage (item_id);
CREATE INDEX IF NOT EXISTS idx_expected_usage_date_time ON expected_usage (date_time);
CREATE INDEX IF NOT EXISTS idx_expected_usage_meal_type ON expected_usage (meal_type);
CREATE INDEX IF NOT EXISTS idx_student_counts_date_time ON student_counts (date_time);
CREATE INDEX IF NOT EXISTS idx_activity_logs_date_time ON activity_logs (date_time);
