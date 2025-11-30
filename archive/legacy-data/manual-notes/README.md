# Manual Notes Archive

These files were previously left under `tmp/` as working scratch data.
They capture intermediate CSVs and markdown notes used when importing
emergence information (日本産蛾類標準図鑑) and manual plant notes.
Keeping them here documents the prior sources without polluting the
tracked `tmp/` workspace.

Files:
- `book1_missing_manual.csv`
- `manual_single.csv`
- `moth_emergence_notes_book1.csv`
- `moth_emergence_notes_book2*.csv`
- `standard1_notes.md`

The ingestion scripts (e.g. `scripts/ingest_book1_manual.mjs`) still
output to `tmp/` when you run them. Move any newly exported files here
only after their content is finalized.
