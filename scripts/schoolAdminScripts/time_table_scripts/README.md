# Excel Upload Feature for Timetable Entries

This feature allows school administrators to upload Excel spreadsheets to automatically populate the timetable_entries table in Supabase.

## Features

- **Excel File Upload**: Upload .xlsx and .xls files
- **Data Preview**: Preview file contents before processing
- **Automatic Data Mapping**: Maps subject names, teacher names, and time slots to database IDs
- **Progress Tracking**: Real-time progress during file processing
- **Error Handling**: Comprehensive error reporting and validation
- **Sample Template**: Download a sample Excel template for reference

## Excel File Format

The Excel file should have the following structure:

1. **First Row**: Headers with day names (Monday, Tuesday, Wednesday, etc.)
2. **First Column**: Time slots (e.g., 8:00, 9:00, 10:00)
3. **Data Cells**: Subject names corresponding to each day and time

### Example Format:

| Time   | Monday    | Tuesday   | Wednesday | Thursday  | Friday    |
|--------|-----------|-----------|-----------|-----------|-----------|
| 8:00   | Mathematics| Science  | English   | History   | Mathematics|
| 9:00   | English   | Mathematics| Science | Mathematics| English   |
| 10:00  | Science   | English   | Mathematics| Science  | History   |

## How to Use

1. **Navigate to Timetable Creation**: Go to the timetable entries creation page
2. **Click Upload Excel**: Click the "Upload Excel" button in the wizard actions
3. **Download Sample Template** (Optional): Click "Download Sample Template" for reference
4. **Select File**: Choose your Excel file (.xlsx or .xls)
5. **Configure Settings**:
   - Set default duration (minutes)
   - Set default room number
6. **Preview Data**: Click "Preview" to see how the data will be processed
7. **Upload**: Click "Upload" to process and save the timetable entries

## Data Processing

The system will:

1. **Validate File Format**: Check for proper day columns and time slots
2. **Match Subjects**: Find subject IDs by matching subject names in the database
3. **Match Teachers**: Assign teachers to subjects (currently uses first available teacher)
4. **Create Entries**: Generate timetable entries with proper foreign key relationships
5. **Save to Database**: Bulk insert valid entries into the timetable_entries table

## Error Handling

- **Missing Subjects**: Entries with subjects not found in the database are skipped
- **No Teachers Available**: Entries without available teachers are skipped
- **Invalid Time Formats**: Invalid time slots are logged as warnings
- **Database Errors**: Bulk insertion errors are reported with details

## Technical Details

- **Frontend**: JavaScript with XLSX library for Excel parsing
- **Backend**: Supabase client for database operations
- **File Processing**: Client-side Excel parsing with server-side data validation
- **Batch Processing**: Entries are inserted in batches of 50 for better performance

## Dependencies

- XLSX library (loaded via CDN)
- Supabase client (already included in the project)
- Modern browser with File API support

## File Locations

- **JavaScript Module**: `scripts/schoolAdminScripts/time_table_scripts/excel_upload.js`
- **HTML Integration**: `html/schoolAdmin/create_timetable_entries.html`
- **Main Timetable Logic**: `scripts/schoolAdminScripts/time_table_scripts/timetable_entries.js`

## Future Enhancements

- Teacher assignment based on subject expertise
- Room assignment from database
- Advanced validation rules
- Import progress persistence
- Undo/rollback functionality
