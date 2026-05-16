import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    const { data, error } = await supabase
        .from('Students')
        .select(`
            *,
            Parent_Student_Links (
                relationship,
                Parents (*)
            ),
            Grades (
                *
            )
        `)
        .limit(3);

    if (error) {
        console.error("Error:", error);
        return;
    }

    // Find a student with parents
    const withParents = data.find(s => s.Parent_Student_Links && s.Parent_Student_Links.length > 0);
    if (!withParents) {
        console.log("No students with parents found in the sample.");
        return;
    }

    console.log("Student ID:", withParents.student_id);
    console.log("Student Name:", withParents.full_name);
    console.log("Parent_Student_Links Type:", Array.isArray(withParents.Parent_Student_Links) ? "Array" : typeof withParents.Parent_Student_Links);
    console.log("Parent_Student_Links:", JSON.stringify(withParents.Parent_Student_Links, null, 2));
}

test();
