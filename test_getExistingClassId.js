// Test script for getExistingClassId function
// This tests the parsing logic and simulates the query

// Mock Supabase client
const mockSupabaseClient = {
  from: (table) => ({
    select: (columns) => ({
      or: (condition) => ({
        ilike: (field, value) => ({
          maybeSingle: () => {
            // Simulate database response based on parsed values
            // For testing, assume "JSS 3 A" exists, others don't
            if (condition.includes('JSS 3') && value === 'A') {
              return Promise.resolve({ data: { class_id: 'mock-class-id-123' }, error: null });
            } else {
              return Promise.resolve({ data: null, error: null });
            }
          }
        })
      })
    })
  })
};

// Copy the getExistingClassId function with mock client
async function getExistingClassId(rawString) {
  if (!rawString) return null;

  // 1. Basic clean: " Jss 3 - A " -> "JSS 3 A"
  let clean = rawString.trim().toUpperCase().replace(/-/g, ' ');

  let className, section;
  let parts = clean.split(/\s+/);

  // 2. PARSING LOGIC
  if (parts.length >= 2) {
    // CASE A: Has spaces (e.g., "JSS 3 A" or "SS 1 A")
    section = parts.pop();      // Last part is Section ("A")
    className = parts.join(' '); // Rest is Class ("JSS 3")
  } else {
    // CASE B: No spaces (e.g., "JSS3B")
    // We use Regex to peel off the last letter
    const match = clean.match(/^(.*)([A-Z])$/);
    if (match) {
      className = match[1]; // "JSS3"
      section = match[2];   // "B"
    } else {
      // Fallback (e.g. input is just "JSS3")
      console.warn(`Could not extract section from: ${clean}`);
      return null;
    }
  }

  // 3. Prepare Variations for DB Search
  let classNameWithSpaces = className;                   // e.g. "JSS 3"
  let classNameNoSpaces = className.replace(/\s+/g, ''); // e.g. "JSS3"

  console.log(`🔎 Parsed: Class="${className}" | Section="${section}"`);

  try {
    // 4. Run the robust DB Search (using mock client)
    let { data: classData, error } = await mockSupabaseClient
      .from('Classes')
      .select('class_id')
      .or(`class_name.ilike.%${classNameWithSpaces}%,class_name.ilike.%${classNameNoSpaces}%`)
      .ilike('section', section)
      .maybeSingle();

    if (classData) {
      return classData.class_id;
    } else {
      console.warn(`❌ Class NOT found in DB. Searched for: Name="${classNameWithSpaces}" OR "${classNameNoSpaces}", Section="${section}"`);
      return null;
    }

  } catch (e) {
    console.error("Class Lookup Error:", e);
    return null;
  }
}

// Test cases
async function runTests() {
  const testCases = [
    { input: "Jss 3 a", expected: "mock-class-id-123" },
    { input: "JSS 3 A", expected: "mock-class-id-123" },
    { input: "JSS3A", expected: "mock-class-id-123" },
    { input: "JSS 2 A", expected: null },
    { input: "Invalid", expected: null },
    { input: "", expected: null },
  ];

  for (const test of testCases) {
    try {
      const result = await getExistingClassId(test.input);
      const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
      console.log(`${status} Input: "${test.input}" | Expected: ${test.expected} | Got: ${result}`);
    } catch (error) {
      console.error(`❌ ERROR for input "${test.input}": ${error.message}`);
    }
  }
}

runTests();
