-- SQL ALTER TABLE commands for new academic fields in Schools table
-- Run these commands to update your database schema

-- Add academic configuration fields to Schools table
ALTER TABLE Schools 
ADD COLUMN academic_session VARCHAR(20) DEFAULT NULL,
ADD COLUMN current_term VARCHAR(20) DEFAULT NULL,
ADD COLUMN next_term_start_date DATE DEFAULT NULL,
ADD COLUMN school_address TEXT DEFAULT NULL;

-- Add setup completion tracking
ALTER TABLE Schools 
ADD COLUMN setup_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN setup_progress INTEGER DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX idx_schools_academic_session ON Schools(academic_session);
CREATE INDEX idx_schools_current_term ON Schools(current_term);
CREATE INDEX idx_schools_setup_completed ON Schools(setup_completed);

-- Update existing records with default values (optional)
UPDATE Schools 
SET 
    academic_session = '2025/2026',
    current_term = 'First',
    setup_progress = 0
WHERE academic_session IS NULL;
