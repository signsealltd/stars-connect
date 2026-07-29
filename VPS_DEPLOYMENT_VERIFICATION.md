# VPS deployment verification

Run these checks on the VPS before merging or deploying. Do not paste `.env`,
PM2 environment values, credentials, tokens, database URLs or personal data into
support messages.

## Read-only inspection

```bash
cd /var/www/vhosts/starsconnect.co.uk/app.starsconnect.co.uk
node --version
pm2 status
pm2 describe stars-connect
pm2 prettylist
find .. -maxdepth 3 \( -name 'ecosystem*.js' -o -name 'ecosystem*.cjs' -o -name 'ecosystem*.json' \) -print
```

Confirm one `stars-connect` process, `fork` mode, one instance and Node 20.9.0
or newer. Review any ecosystem file locally; do not share its environment block.

Run the safe verifier after loading the production environment through the same
protected mechanism used by PM2:

```bash
node scripts/verify-deployment-config.mjs
```

It reports variable names and safe failure reasons only. Before running it, set:

- `PM2_APP_NAME=stars-connect`
- `APP_WEB_ROOT` to the application checkout
- `HSTS_INCLUDE_SUBDOMAINS_ACKNOWLEDGED=true` only after checking every affected
  subdomain
- `REVERSE_PROXY_HEADERS_ACKNOWLEDGED=true` only after verifying the headers below

## Reverse proxy

Inspect the active Plesk/nginx configuration locally:

```bash
plesk bin nginx -t
nginx -T 2>/dev/null | grep -n -E 'server_name|proxy_pass|proxy_set_header|X-Forwarded|Host'
```

The application proxy must preserve the public host and send:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

With exactly one trusted reverse proxy, configure `TRUSTED_PROXY_HOPS=1`.
Confirm `APP_URL=https://app.starsconnect.co.uk`.

## HTTPS and HSTS acknowledgement

List every DNS name below `starsconnect.co.uk`, then check each intended public
name individually:

```bash
curl -fsSI https://app.starsconnect.co.uk/
curl -fsSI https://starsconnect.co.uk/
curl -fsSI https://www.starsconnect.co.uk/
```

Do not acknowledge `includeSubDomains` until all existing and planned subdomains
are HTTPS-capable or intentionally unreachable.
