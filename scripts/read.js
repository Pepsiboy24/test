const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


const excelSheet = document.querySelector("[data-sth]");

const newLocal = "change";
excelSheet.addEventListener("change", (e) => {
     const file = e.target.files[0];
     if (!file) return;

     const reader = new FileReader();

     reader.onload = async function (event) {
       // 1️⃣ Read Excel
       const data = new Uint8Array(event.target.result);
       const workbook = XLSX.read(data, { type: "array" });

       // 2️⃣ Get first sheet
       const sheet = workbook.Sheets[workbook.SheetNames[0]];

       // 3️⃣ Convert to CSV
       const csv = XLSX.utils.sheet_to_csv(sheet);

       // 4️⃣ Parse CSV into JSON rows
       const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
       const rows = parsed.data;
       rows.forEach((row) => {
         row.password = "123456"; // you must have a `password` column in Supabase
       });

       console.log("Uploading rows:", rows);

       // 5️⃣ Insert into Supabase
       const { data: inserted, error } = await supabaseClient
         .from("students") // change to your table name
         .insert(rows);

       if (error) {
         console.error(error);
         alert("Upload failed: " + error.message);
       } else {
         console.log("Upload success:", inserted);
         alert("Students added!");
       }
     };

     reader.readAsArrayBuffer(file);
  console.log(e.target.files[0]);
});
