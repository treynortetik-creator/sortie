-- Sortie: Lead Capture App Schema

-- Status enum
CREATE TYPE capture_status AS ENUM ('captured', 'processing', 'ready', 'needs_review', 'error');

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  default_event TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Captures table
CREATE TABLE captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  photo_url TEXT,
  audio_url TEXT,
  audio_duration REAL,
  extracted_name TEXT,
  extracted_company TEXT,
  extracted_email TEXT,
  extracted_phone TEXT,
  notes TEXT,
  audio_transcription TEXT,
  transcription_source TEXT,
  sf_match_status TEXT,
  sf_account_id TEXT,
  sf_contact_id TEXT,
  clay_data JSONB,
  email_draft TEXT,
  status capture_status NOT NULL DEFAULT 'captured',
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_captures_user_id ON captures(user_id);
CREATE INDEX idx_captures_event_name ON captures(event_name);
CREATE INDEX idx_captures_status ON captures(status);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_name ON events(name);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own profile" ON profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own events" ON events
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own captures" ON captures
  FOR ALL USING (auth.uid() = user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('captures', 'captures', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Users can upload captures" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'captures' AND auth.role() = 'authenticated');

CREATE POLICY "Public read captures" ON storage.objects
  FOR SELECT USING (bucket_id = 'captures');
