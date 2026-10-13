# Archived Aspire client Excel workbooks

Copied here after the one-time clean load (apply run 2026-10-05T13-01-31-768Z).

- Source of truth is now PostgreSQL (ClientProfile + Vendor + Location).
- Do not use these files for ongoing edits.
- Re-run QA with: npm run scripts:migrate-excel -- --qa-only
  (script still reads workbooks from the project root if present.)
