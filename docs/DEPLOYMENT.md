# Deployment

ArtifactGuard is one Node 22 process that serves the UI and the API. Any host that runs a container or Node 22, serves HTTPS and can reach `api.sanity.io` will work.

## Environment

| Variable | Value |
|---|---|
| `ARTIFACTGUARD_MODE` | `live` |
| `SANITY_GROQ_MCP_URL` | Dataset endpoint URL |
| `SANITY_KB_MCP_URL` | Knowledge Base endpoint URL |
| `SANITY_ORGANIZATION_TOKEN` | Context Viewer token. Set it as a host secret, never in the repo. |
| `SANITY_PROJECT_ID` | Optional. Shown at `/api/meta`. |

The host normally sets `PORT`. The default is `3000`.

## Render

Render's free instance needs no code changes and runs the `Dockerfile` as is.

1. New → Web Service, connect the repository.
2. Runtime: **Docker**. Instance type: **Free**.
3. Add the environment variables above.
4. Deploy, then open the URL.

A free instance spins down after 15 minutes without inbound traffic, and the first request afterwards takes about a minute. Render includes 750 free instance hours a month, and one service running all month uses 744 in a 31-day month, so keep a single free service on the workspace.

To keep it awake, add an HTTP monitor on the service URL in UptimeRobot (free plan: 5-minute interval, no card). The monitor is traffic like any other, and a check every 5 minutes keeps the instance running.

## Docker

```bash
docker build -t artifactguard .
docker run -p 3000:3000 --env-file .env artifactguard
```

The image runs as the unprivileged `node` user and has a healthcheck on `/`.

## After deploying

- `/api/context-status` lists `groq_query` and `knowledge_base_read`.
- The flagship case returns `CONDITIONAL` and the Knowledge Base box says "Live Sanity Knowledge Base".
- `/compare` shows 25 rows. `/method` loads.
- `BASE_URL=https://your-app.example npm run check:deployed` passes every benchmark scenario against the live data.
- The browser network panel never shows the token.
- It works on a phone.

## Operating notes

- Every `/api/` route is limited to 120 requests per minute per client; `POST /api/analyze` and `POST /api/interpret` share a stricter limit of 30. Health checks are cached for 15 seconds. Behind a proxy the client is read from the last `X-Forwarded-For` entry.
- Knowledge Base responses are cached for 5 minutes and the dataset for 30 seconds. The limiter and the cache are in memory, so run one instance.
- The app logs one JSON line per request to stdout (time, request id, method, path, status, duration). It never logs IP addresses or query strings. Failures from Sanity are logged to stderr, and the browser only gets a generic message.
- When the request arrives with `X-Forwarded-Proto: https`, the app adds a `Strict-Transport-Security` header.
- The server accepts only origin-form request targets (`/path`). Anything else returns 400.
