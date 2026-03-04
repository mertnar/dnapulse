/*
  # DNA Pulse Database Schema

  ## Overview
  Creates the complete database schema for DNA Pulse - an AI-integrated endpoint telemetry & monitoring platform.

  ## New Tables

  ### 1. organizations
  - `id` (uuid, primary key)
  - `name` (text) - Organization name
  - `created_at` (timestamptz)

  ### 2. users
  - `id` (uuid, primary key, references auth.users)
  - `email` (text)
  - `full_name` (text)
  - `organization_id` (uuid, references organizations)
  - `role` (text) - User role
  - `avatar_url` (text)
  - `created_at` (timestamptz)

  ### 3. data_sources
  - `id` (uuid, primary key)
  - `organization_id` (uuid, references organizations)
  - `name` (text)
  - `type` (text) - Agent, ELK/Elastic, API/Webhook, Custom SDK, Network/IoT Stream
  - `status` (text) - active, inactive, error
  - `throughput` (integer) - events per second
  - `last_seen` (timestamptz)
  - `config` (jsonb) - Source configuration
  - `created_at` (timestamptz)

  ### 4. events
  - `id` (uuid, primary key)
  - `organization_id` (uuid, references organizations)
  - `source_id` (uuid, references data_sources)
  - `event_type` (text)
  - `severity` (text)
  - `payload` (jsonb)
  - `tenant` (text)
  - `tags` (text[])
  - `timestamp` (timestamptz)

  ### 5. rules
  - `id` (uuid, primary key)
  - `organization_id` (uuid, references organizations)
  - `name` (text)
  - `description` (text)
  - `query` (text)
  - `schedule` (text) - cron expression
  - `severity` (text)
  - `output_type` (text) - Alert, Metric, New Data Model
  - `enabled` (boolean)
  - `last_run` (timestamptz)
  - `next_run` (timestamptz)
  - `match_count` (integer)
  - `created_at` (timestamptz)

  ### 6. alerts
  - `id` (uuid, primary key)
  - `organization_id` (uuid, references organizations)
  - `rule_id` (uuid, references rules)
  - `source_id` (uuid, references data_sources)
  - `severity` (text) - critical, high, medium, low
  - `status` (text) - new, acknowledged, investigating, resolved, closed
  - `title` (text)
  - `description` (text)
  - `related_events` (jsonb)
  - `assigned_to` (uuid, references users)
  - `created_at` (timestamptz)
  - `resolved_at` (timestamptz)

  ### 7. investigations
  - `id` (uuid, primary key)
  - `organization_id` (uuid, references organizations)
  - `title` (text)
  - `owner_id` (uuid, references users)
  - `status` (text) - open, investigating, resolved, closed
  - `time_range_start` (timestamptz)
  - `time_range_end` (timestamptz)
  - `related_alert_ids` (uuid[])
  - `notes_count` (integer)
  - `created_at` (timestamptz)

  ### 8. investigation_notes
  - `id` (uuid, primary key)
  - `investigation_id` (uuid, references investigations)
  - `user_id` (uuid, references users)
  - `content` (text)
  - `created_at` (timestamptz)

  ### 9. agents
  - `id` (uuid, primary key)
  - `organization_id` (uuid, references organizations)
  - `name` (text)
  - `version` (text)
  - `status` (text) - active, inactive, error
  - `deployed_endpoints` (integer)
  - `data_types` (text[])
  - `config` (jsonb)
  - `created_at` (timestamptz)

  ### 10. data_models
  - `id` (uuid, primary key)
  - `organization_id` (uuid, references organizations)
  - `name` (text)
  - `type` (text) - base, derived
  - `schema` (jsonb)
  - `source_models` (uuid[])
  - `created_at` (timestamptz)

  ### 11. ml_models
  - `id` (uuid, primary key)
  - `organization_id` (uuid, references organizations)
  - `name` (text)
  - `type` (text) - anomaly, classification
  - `version` (text)
  - `status` (text) - training, ready, error
  - `last_trained` (timestamptz)
  - `config` (jsonb)
  - `created_at` (timestamptz)

  ### 12. lifecycle_policies
  - `id` (uuid, primary key)
  - `organization_id` (uuid, references organizations)
  - `name` (text)
  - `hot_retention_days` (integer)
  - `medium_retention_days` (integer)
  - `cold_retention_days` (integer)
  - `data_type` (text)
  - `created_at` (timestamptz)

  ### 13. roles
  - `id` (uuid, primary key)
  - `organization_id` (uuid, references organizations)
  - `name` (text)
  - `permissions` (jsonb)
  - `created_at` (timestamptz)

  ### 14. audit_logs
  - `id` (uuid, primary key)
  - `organization_id` (uuid, references organizations)
  - `user_id` (uuid, references users)
  - `action` (text)
  - `resource_type` (text)
  - `resource_id` (uuid)
  - `before_state` (jsonb)
  - `after_state` (jsonb)
  - `ip_address` (text)
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users to access their organization's data
*/

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  role text DEFAULT 'user',
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  status text DEFAULT 'active',
  throughput integer DEFAULT 0,
  last_seen timestamptz DEFAULT now(),
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  source_id uuid REFERENCES data_sources(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  severity text DEFAULT 'info',
  payload jsonb DEFAULT '{}',
  tenant text,
  tags text[] DEFAULT '{}',
  timestamp timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  query text NOT NULL,
  schedule text DEFAULT '*/5 * * * *',
  severity text DEFAULT 'medium',
  output_type text DEFAULT 'Alert',
  enabled boolean DEFAULT true,
  last_run timestamptz,
  next_run timestamptz,
  match_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  rule_id uuid REFERENCES rules(id) ON DELETE SET NULL,
  source_id uuid REFERENCES data_sources(id) ON DELETE SET NULL,
  severity text DEFAULT 'medium',
  status text DEFAULT 'new',
  title text NOT NULL,
  description text,
  related_events jsonb DEFAULT '[]',
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text DEFAULT 'open',
  time_range_start timestamptz,
  time_range_end timestamptz,
  related_alert_ids uuid[] DEFAULT '{}',
  notes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investigation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid REFERENCES investigations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  version text DEFAULT '1.0.0',
  status text DEFAULT 'active',
  deployed_endpoints integer DEFAULT 0,
  data_types text[] DEFAULT '{}',
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text DEFAULT 'base',
  schema jsonb DEFAULT '{}',
  source_models uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ml_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  version text DEFAULT '1.0.0',
  status text DEFAULT 'ready',
  last_trained timestamptz,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lifecycle_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  hot_retention_days integer DEFAULT 7,
  medium_retention_days integer DEFAULT 30,
  cold_retention_days integer DEFAULT 365,
  data_type text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  permissions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  before_state jsonb,
  after_state jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE lifecycle_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view data sources in their organization"
  ON data_sources FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view events in their organization"
  ON events FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view rules in their organization"
  ON rules FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view alerts in their organization"
  ON alerts FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view investigations in their organization"
  ON investigations FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view investigation notes in their organization"
  ON investigation_notes FOR SELECT
  TO authenticated
  USING (
    investigation_id IN (
      SELECT id FROM investigations WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can view agents in their organization"
  ON agents FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view data models in their organization"
  ON data_models FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view ML models in their organization"
  ON ml_models FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view lifecycle policies in their organization"
  ON lifecycle_policies FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view roles in their organization"
  ON roles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view audit logs in their organization"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
