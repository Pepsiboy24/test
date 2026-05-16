-- Create the study_materials table
CREATE TABLE study_materials (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    uploaded_by VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_study_materials_subject ON study_materials(subject);
CREATE INDEX idx_study_materials_type ON study_materials(type);
CREATE INDEX idx_study_materials_uploaded_at ON study_materials(uploaded_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Public read access for study materials" ON study_materials
    FOR SELECT USING (true);

-- Create policies for authenticated users to insert
CREATE POLICY "Authenticated users can insert study materials" ON study_materials
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create storage bucket for study materials
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-materials', 'study-materials', true);

-- Create storage policies
CREATE POLICY "Public read access for study materials storage" ON storage.objects
    FOR SELECT USING (bucket_id = 'study-materials');

CREATE POLICY "Authenticated users can upload study materials" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'study-materials' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their own study materials" ON storage.objects
    FOR UPDATE USING (bucket_id = 'study-materials' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete their own study materials" ON storage.objects
    FOR DELETE USING (bucket_id = 'study-materials' AND auth.role() = 'authenticated');
