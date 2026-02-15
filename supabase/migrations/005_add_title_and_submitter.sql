-- Add extracted_title column for job title extraction
ALTER TABLE captures ADD COLUMN IF NOT EXISTS extracted_title TEXT;

-- Add submitter_email so exports show who captured each lead
ALTER TABLE captures ADD COLUMN IF NOT EXISTS submitter_email TEXT;
