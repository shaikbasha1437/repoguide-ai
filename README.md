# RepoGuide AI

**Follow the code. Trace every answer to the source.**

[Open the app](https://shaikbasha1437.github.io/repoguide-ai/)

A free, static, local-first codebase Q&A agent. No backend, account or model key required for extractive mode. Import a GitHub repository or a source ZIP, build an index in your browser, ask questions, and jump from each answer to the cited file and highlighted lines.

## Quick start

1. Click **Explore demo** for the original fictional **LanternBoard** snapshot (13 files, MIT).
2. Ask “How does authentication work?”, “Where are task queries scoped to a team?” or “What is the rate limit?”
3. Click a citation to inspect the exact source and chunk boundaries.
4. Export Q&A to Markdown, including quotations and file:line citations.

The demo is source-only teaching material, not a runnable service. RepoGuide never executes repository code. Example domains end in `.example`; no credentials are bundled.

## Import your code

- **Connect GitHub:** `owner/repo`, `https://github.com/owner/repo`, or an optional `/tree/branch` URL. An explicit branch/tag field overrides the URL. Branches containing slashes are supported. Browser calls go directly to `api.github.com`.
- GitHub imports pin the resolved commit SHA, preventing a moving branch from mixing revisions during import.
- **Upload ZIP:** parsed locally using a bundled, pinned copy of fflate 0.8.2 (MIT). Nothing is uploaded to a server. Unsupported compression / encrypted ZIPs may fail; ordinary ZIP/DEFLATE is supported.
- The workspace (files, serialized lexical index, chat, optional vectors) is persisted in IndexedDB. A repeat visit does not re-fetch GitHub. **Re-index** rebuilds the cached snapshot, not the remote repo; reload its URL for a fresh commit.
- Replacing, clearing and re-indexing require confirmation and have a 12-second undo toast.

### Limits and rate budget

A snapshot contains at most **40 text files**, **200 KB per file**, **4 MB total text**. ZIP uploads must be at most **12 MB compressed**. ZIP expansion is filtered before decompression with a 4 MB accepted-total budget. Unsafe paths are rejected. Extra files are listed under **Skipped files & limits**. Large GitHub recursive trees can themselves be truncated; the snapshot is clearly labeled partial.

GitHub's unauthenticated API budget is **60 requests/hour per IP**. Imports use 3 metadata requests, then 1 blob request per eligible file (up to 43 requests total). The app reads remaining quota and reset headers, displays them in the connection dialog, stops before exhausting known quota, and never automatically retries rate-limit errors. Rate-limited or failed imports preserve your previous workspace. The optional GitHub PAT goes only to `api.github.com`; a private repo needs appropriate read permissions. Do not share your PAT.

Excluded: `.env` variants (including examples), private keys, common credential files/folders, binaries/images, lockfiles, minified bundles, generated output, `node_modules`, `vendor`, `dist`, and unusually long (>3,000-character) lines. See `js/core.js` for the full rules. Token-pattern / inline password redaction is defense in depth, **not a complete secret scanner**. Review files before using live mode. Skipped contents never enter the index or model prompt.

## Retrieval and grounding

1. Chunk source at heading / function / class boundaries where possible; fall back to overlapping windows (42 lines / about 1,800 characters, with 5-line overlap). Exact original line ranges are retained after line-ending normalization. Redaction preserves line count.
2. Build a dependency-free **BM25 lexical index** with code-aware tokenization, camel-case splitting and a small synonym map. Always available offline.
3. Retrieve 5 chunks per question. Short follow-ups include the previous question in fresh retrieval; live calls also include the last 3 Q&A turns.
4. **Extractive / no-key mode** returns real source excerpts, not a simulated AI narrative. This works for imported public repos too. Source relevance and answer completeness are limited by lexical matching.
5. **Live mode** asks the selected model for structured claims with exact chunk IDs and quotes. The UI flags missing/invalid citations, non-matching quotations, weak lexical support and numbers absent from evidence. Unknown citations are never turned into clickable trusted sources.

Flags are conservative **heuristics, not proof of factual correctness**. A valid quote may still not support a model's conclusion. Answers can miss code outside the retrieved chunks. Always inspect the source.

## Bring your own model

Settings supports OpenAI, Anthropic, Google Gemini, or an OpenAI-compatible endpoint such as OpenRouter, Ollama or LM Studio. All calls go directly from your browser to that provider. Anthropic requests include `anthropic-dangerous-direct-browser-access: true`. Model IDs can be edited. Compatible endpoints must be HTTPS or localhost; local servers must allow this site's origin (CORS) and may trigger a local-network permission prompt.

Keys are **memory-only by default**. Opt in to “Remember settings & keys on this device” to store them in localStorage (not encrypted; avoid shared devices). Clear that checkbox and save to remove remembered keys. GitHub PATs are never passed to model providers. Chat and embedding keys are separate. Settings, tokens and keys are excluded from transcript exports and share links; known secret values are redacted defensively. Share links carry only a redacted question, not the repository or answers. No analytics or telemetry.

Live prompts include your question, recent conversation and retrieved source, so only enable them for code you have permission to transmit. Repository text is untrusted data; the model is explicitly instructed to ignore instructions inside it. No tools, code execution, email, issues, comments or other external write actions are available to the model.

### Optional hybrid embeddings

Set an OpenAI-compatible embedding base URL, model (default `text-embedding-3-small`) and separate key, then click **Vector index**. You explicitly confirm transmission of the indexed chunks and possible charges before this call. Batches contain at most 16 texts. Vectors persist locally. Query embeddings plus BM25 use reciprocal-rank fusion. Failed query embeddings fall back to BM25; changing the embedding model/base disables mismatched vectors until rebuilt.

Embeddings are optional and not part of the offline demo. In-browser Transformers.js/WebLLM are not included. Chat uses complete structured JSON responses, **not token streaming**. Unsupported/invalid JSON is rejected rather than shown as grounded output.

## Offline, privacy and controls

The network-first, versioned service worker caches each same-origin asset individually, including the original demo. Third-party API traffic is never cached. After the first online visit, you can reload offline, load the demo and use extractive chat. Browser storage quotas / private modes can limit persistence. Clear index removes the app's active IndexedDB workspace (undo is briefly retained in memory), not model settings or the PWA shell cache; use browser site-data controls to remove everything.

Every app modal supports X, Cancel, Escape, backdrop click and browser Back; dirty settings/import fields ask before discard. Cancel is never blocked by validation. Source viewer supports chunk boundary navigation and highlighted citation ranges. Keyboard focus is trapped in dialogs and restored on close. Light/dark themes and phone layouts are included.

## Develop and test

```sh
npm test                     # Node 20+, no dependencies or real keys
python3 -m http.server 8080   # serve this folder, then open localhost:8080
```

Pure Node tests cover ignore/secret rules, chunk boundaries/overlap/coverage, BM25 rankings, hybrid fusion, quote grounding and unsupported claim flags, export redaction, GitHub parsing/quota behavior and commit pinning, ZIP filtering, and mocked provider/embedding requests. No real API keys are used in tests. Live browser verification is recorded in `VERIFICATION.md`; Playwright scripts are intentionally outside this repository.

## Structure and license

- `js/core.js`: pure safety filters, chunker, BM25, citations, exports
- `js/github.js`: rate-aware, read-only browser loader
- `js/embeddings.js`: optional vector requests
- `js/llm.js`: shared AgentKit provider client; `llm.cjs` is its Node test mirror
- `js/storage.js`: IndexedDB persistence
- `js/app.js`: local workspace, explorer, chat and modals
- `samples/lanternboard.json`: original fictional MIT demo
- `vendor/fflate.js`: pinned ZIP implementation with upstream license

MIT. This app and the fictional demo are original open-source work; imported repositories retain their own licenses.
