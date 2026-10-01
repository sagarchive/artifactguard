# Threat model

The app is public and unauthenticated. What matters is the Sanity token, the integrity of the verdict, and not being used to drain the Sanity quota.

| Threat | Mitigation |
|---|---|
| Token theft | The token is only read server-side. No response includes it. Upstream error bodies are logged, not returned. |
| Malformed or hostile input | Bodies must be JSON objects. Questions are strings up to 500 characters, matched against catalog words only. Ids must be short strings in bounded arrays. `environment` and `contact` accept fixed values only and bad values return 400. The calculator accepts finite positive numbers only. Unknown fields are dropped. |
| Wrong verdict from bad input | Unknown ids, missing scope and unreadable evidence resolve to `INSUFFICIENT`. They never default to `SUPPORTED`. A Context outage cannot approve anything because the structured dataset is required. |
| Quota abuse | Every `/api/` route is limited to 120 requests per minute per client, and analyses and interpretations to 30 (shared). Health checks are cached for 15 seconds. A 5-minute Knowledge Base cache, and a 30-second dataset cache. |
| XSS | Evidence text is escaped before rendering. CSP is `default-src 'self'`, with no inline script or style and no third-party scripts. |
| Clickjacking, MIME sniffing | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`. |
| Path traversal | Static files are served from `public/` only, after path normalization. Tested against encoded and plain `..` paths. |
| Malformed request targets | Only origin-form targets (`/path`) are accepted. Anything else, such as `//host/path` or an absolute URL, returns 400. Before this check, `GET //` crashed the process. |
| Slow or oversized requests | Body size caps (16 KB analyze, 4 KB calculator), request and header timeouts. |
| Prompt injection through Knowledge Base text | There is no language model. Knowledge Base text is displayed as context and never changes the verdict. |

## Residual risks

- The rate limiter and cache are per process. A scaled-out deployment needs a shared store.
- Behind a proxy, rate limiting trusts the last `X-Forwarded-For` entry. Without a proxy, clients can spoof it.
- HSTS and TLS are the host's responsibility.
- The public dataset exposes all 363 documents by design.
- If a language model is added later, it should only parse input into a validated scenario object, and its output must never set the verdict.
