-- Create teacher_student_messages table for private messaging
CREATE TABLE teacher_student_messages (
    id SERIAL PRIMARY KEY,
    sender_id VARCHAR(255) NOT NULL,
    receiver_id VARCHAR(255) NOT NULL,
    sender_type VARCHAR(50) NOT NULL, -- 'student' or 'teacher'
    subject VARCHAR(255),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_teacher_student_messages_sender_receiver ON teacher_student_messages(sender_id, receiver_id);
CREATE INDEX idx_teacher_student_messages_sent_at ON teacher_student_messages(sent_at DESC);
CREATE INDEX idx_teacher_student_messages_is_read ON teacher_student_messages(is_read);

-- Enable Row Level Security (RLS)
ALTER TABLE teacher_student_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for message access
-- Students can read messages where they are sender or receiver
CREATE POLICY "Students can read their own messages" ON teacher_student_messages
    FOR SELECT USING (
        sender_id = auth.jwt() ->> 'sub' OR
        receiver_id = auth.jwt() ->> 'sub'
    );

-- Teachers can read messages where they are sender or receiver
CREATE POLICY "Teachers can read their messages" ON teacher_student_messages
    FOR SELECT USING (
        sender_id = auth.jwt() ->> 'sub' OR
        receiver_id = auth.jwt() ->> 'sub'
    );

-- Users can insert messages
CREATE POLICY "Users can send messages" ON teacher_student_messages
    FOR INSERT WITH CHECK (sender_id = auth.jwt() ->> 'sub');

-- Users can update read status for messages they received
CREATE POLICY "Users can mark messages as read" ON teacher_student_messages
    FOR UPDATE USING (
        receiver_id = auth.jwt() ->> 'sub'
    ) WITH CHECK (
        receiver_id = auth.jwt() ->> 'sub'
    );
