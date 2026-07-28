# Pre-remediation source snapshot

This folder preserves the reviewed STARS Connect source immediately before the
controlled production-remediation campaign.

- Preserved application baseline: `d4658e0c363fa08ec53e24be62a7f3dd439fbeef`
- Preservation commit: `fef59cc5bdb17a455a59508b31016fc30b2d3b38`
- Recorded baseline time: `2026-07-28T20:04:44Z`
- Archive: `stars-connect-pre-remediation-20260728-2004-fef59cc.tar.gz`
- Primary recovery references:
  `backup/pre-remediation-20260728-2004` and
  `pre-remediation-20260728-2004-fef59cc`

Restore the source into a new empty directory:

```bash
mkdir stars-connect-restored
tar -xzf stars-connect-pre-remediation-20260728-2004-fef59cc.tar.gz \
  -C stars-connect-restored
```

Verify the archive before restoration:

```bash
sha256sum -c stars-connect-pre-remediation-20260728-2004-fef59cc.tar.gz.sha256
```

The archive was created with `git archive` from the preservation commit. It
therefore omits untracked and ignored material such as `.env`, local production
configuration, credentials, tokens, certificates, private keys, database dumps,
`node_modules`, `.next`, caches, logs, photographs, visitor signatures,
generated PDFs, payroll documents, invoices, uploads and backup keys. The safe
tracked `.env.example` is included.

This is a source-only snapshot. It is **not** a MariaDB backup and contains no
operational data or private-file backup. Git history, the preservation branch
and the permanent tag remain the primary source-code recovery mechanism.
