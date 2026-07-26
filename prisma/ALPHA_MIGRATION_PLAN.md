# Alpha database migration plan

The live alpha database was created with `prisma db push` before migration history existed.

Do **not** run the committed initial migration against that populated database: it creates every table and is intended as the baseline for new installations.

For the existing alpha VPS:

1. Take and verify a MariaDB backup.
2. Pull the release and run `npx prisma generate`.
3. Review the non-destructive additions in `prisma/schema.prisma`.
4. During the alpha phase only, run `npx prisma db push`.
5. After confirming the schema matches, baseline migration history:

   ```bash
   npx prisma migrate resolve --applied 202607250001_initial_stars_connect
   ```

6. Verify `_prisma_migrations`, application startup, staff, students, devices, reports and sync.

New databases should use:

```bash
npx prisma migrate deploy
```

All subsequent schema changes must use reviewed migrations rather than `db push`.

## Visitor management migration

The visitor module adds migration `202607260001_visitor_management`.

- If the baseline is already recorded in `_prisma_migrations`, take a backup and run `npx prisma migrate deploy` to apply the visitor migration.
- If the alpha still has no migration history and is updated with `npx prisma db push`, confirm the visitor tables and enum values exist, then mark both migrations applied:

```bash
npx prisma migrate resolve --applied 202607250001_initial_stars_connect
npx prisma migrate resolve --applied 202607260001_visitor_management
```

Never run `migrate resolve` before confirming that `db push` completed successfully. When using `db push`, run `npm run db:bootstrap-visitors` to add only the production-safe default visitor reasons, initial rules and retention settings; it does not create demo users, staff or students.
