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
