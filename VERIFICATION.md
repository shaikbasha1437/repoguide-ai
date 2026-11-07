# Verification record

Verified November 7, 2026 (America/Chicago, CST). No real model, embedding or GitHub keys were used.

## Automated checks

- **123 passing Node tests**, no dependencies, all provider/GitHub calls mocked.
- **101/101 live-site checks in Google Chrome** and **101/101 in Firefox** via Playwright, in fresh browser contexts.
- Fresh visit, cached repeat visit without re-fetch, light/dark persistence, 390px phone layout without horizontal overflow, source search and chunk navigation, Markdown downloads, clear/re-index confirmation and undo.
- Every modal (settings, GitHub import, source viewer, limits and clipboard-fallback share) closed via X, Cancel, Esc, backdrop and browser Back. Unsaved-edits decline/accept and required-field cancellation were tested.
- Offline reload created a new document, restored the local demo, answered a new question with citations, and reloaded the bundled snapshot with no network. Firefox's offline phase ran without Playwright request interception (interception disables its normal service-worker navigation behavior).
- No uncaught application errors.

## Full demo flow

LanternBoard: **13 files, 13 chunks, about 2,712 estimated tokens**.

| Question | Representative citations / source evidence |
| --- | --- |
| How does authentication work? | `src/auth.js:24–31`, `README.md:21–28`, `test/auth.test.js:3–10`: session lookup/expiry and tests |
| What is the rate limit? | `src/rate-limit.js:1–17`, `test/rate-limit.test.js:1–12`, `src/api.js:2–9`: 30 requests per 60-second window, per account |
| Where are task database queries scoped to a team? | `src/database.js:2–9`, `test/tasks.test.js:9–16`, `README.md:9–16`: team-scoped parameterized queries and test assertions |
| What behavior do the tests cover? | `test/rate-limit.test.js:1–12`, `test/tasks.test.js:1–8`, `test/auth.test.js:1–8`: rate limit, title validation and session expiry |

All **12 citations** were clicked; every highlighted range matched the original source lines. No grounding flags on these extractive answers. An unmatched nonsense question abstained. A mocked live answer with an unsupported “999 hours” claim and nonexistent file citation was flagged; the nonexistent source was not linked.

Extractive mode returns source excerpts, not a generated explanation. The table summarizes what the tested sources contain, not a claim that a real LLM generated a correct answer.

## Browser integrations

- OpenAI, Anthropic, Gemini and compatible chat: complete browser UI flow with intercepted, mocked responses and fake keys. Anthropic browser opt-in header checked. Recent Q&A + fresh retrieval checked; GitHub PAT absent from provider requests.
- Real network, deliberately invalid keys: **Anthropic 401, Gemini 400, OpenRouter 401** were readable from the live origin. This confirms browser transport/CORS, **not successful generation**.
- OpenAI chat and embeddings invalid-key replies were not readable because of CORS; genuine-key operation remains unverified. Ollama / LM Studio were not end-to-end tested.
- Optional embeddings: separate fake embedding key, consent, vector construction, hybrid retrieval and query vector tested against mocked endpoint. No paid/real embedding request.
- GitHub import: mocked branch/ref, quota, secret-file exclusions and 4-request one-file flow. Also imported **octocat/Hello-World** from the live site using **4 real unauthenticated read requests**, producing one README file/chunk and a correct `README:1–2` citation. Remaining quota was exposed correctly; no authenticated user budget or token used.
- ZIP: local source import, unsafe-path / secret / dependency filtering, and confirmation that source code never executes.
- Exports / question-only links did not contain known fake keys, PATs or settings.

## Honest limits

40 files / 4 MB text per snapshot, 200 KB per file, 12 MB compressed ZIP; snapshots can be truncated. Unauthenticated GitHub API allows 60 requests/hour per IP. Secret detection and claim grounding are heuristics. No in-browser model or streaming implementation. Browser-local remembered keys are opt-in and not encrypted. Live model quality, private-repo access with a genuine PAT and genuine-key embeddings are unverified.

External Playwright scripts and screenshots live in `/workspace/e2e`, not in this repository.
