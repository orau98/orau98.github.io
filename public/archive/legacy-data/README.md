This folder stores legacy CSV data that is no longer used at runtime when VITE_USE_NORMALIZED_ONLY=true.

These files are kept for reference and historical comparison but are not loaded by the app. The app now reads:
- public/insects.csv
- public/hostplants.csv
- public/general_notes.csv

If you need to re-enable legacy parsing, disable normalized-only mode and restore files to public/.
