# V1.7.1 — Current client presence

Fixes current presence on the dashboard, Who is on site, and new offline emergency roll calls. Present/Late attendance records with a departure time are excluded. Offsite records remain in the Offsite count and are excluded from current presence. Returning to Present clears departure in the existing register flow and restores current presence. Expected today and Not yet marked remain based on the daily register, preserving attendance history.

An already-started emergency roll call retains its snapshot for evacuation accountability. Updating an accounted-for checkbox now preserves that roll call's original start time. The heading reads People in roll call to distinguish this snapshot from current live occupancy.

The service-worker shell cache is refreshed so tablets can cache the corrected emergency page when next online. No database migration or historic data modification is required.

Version: V1.7.0 → V1.7.1. Validation: 14 focused attendance/emergency tests passed; full suite 527 passed, 18 database integration tests skipped. Type checking passed.
Production build passed, including lint/type validation and all 138 static pages.
