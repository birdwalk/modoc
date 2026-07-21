# AI Grounding

AI must explain deterministic evidence supplied by the backend. It must not invent issue counts, dimensions, materials, tolerances or geometry defects.

The MVP uses a deterministic fallback response schema:

- Summary.
- Priority issues.
- Readiness assessment.
- Limitations.
- Recommended next steps.
- Disclaimer.

When OpenAI Responses API integration is enabled, the backend should send only structured evidence, never the uploaded binary model or API key to the browser.
