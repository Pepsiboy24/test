-- Create chat_messages table for social features
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    group_name VARCHAR(50) NOT NULL,
    sender VARCHAR(255) NOT NULL,
    sender_type VARCHAR(50) NOT NULL, -- 'student', 'teacher', 'admin'
    message TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_chat_messages_group_name ON chat_messages(group_name);
CREATE INDEX idx_chat_messages_sent_at ON chat_messages(sent_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Public read access for chat messages" ON chat_messages
    FOR SELECT USING (true);

-- Create policies for authenticated users to insert
CREATE POLICY "Authenticated users can insert chat messages" ON chat_messages
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
