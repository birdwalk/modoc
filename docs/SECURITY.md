# Security

Implemented MVP controls:

- Server-side extension validation.
- Configurable upload size limit.
- Safe filename extraction.
- SHA-256 checksum and duplicate detection.
- Upload and artifact separation.
- Path traversal check for artifact downloads.
- Restricted local-development CORS.
- No API key exposed to browser.
- No binary contents logged intentionally.

Production gaps:

- Authentication.
- Organization authorization.
- Rate limiting.
- Persistent audit database.
- Worker timeouts and memory enforcement.
- Malware scanning and deeper parser sandboxing.
