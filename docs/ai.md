<!-- docs/ai.md -->

# AI in EventOps

EventOps uses one open-weight AI model, for one job: **suggesting how the columns of an imported
spreadsheet match EventOps fields.** It is an assistant for messy data, not an authority. Decisions
D-108 to D-112 record the rules; this page explains them.

| | |
| --- | --- |
| **Model** | Qwen2.5 7B Instruct (`qwen2.5:7b-instruct` in Ollama) |
| **License** | Apache-2.0 |
| **Weights** | Open, publicly available |
| **Runs on** | [Ollama](https://ollama.com), self-hosted (Docker Compose file in the repository) |
| **Purpose** | Suggest the import type and the column → field matching (B9-F12) |
| **Called from** | The server only (`src/modules/events/import/infrastructure/extractors/llm-extractor.ts`) |
| **Turned on by** | `AI_IMPORT_ENABLED=true` **and** `OLLAMA_URL` set |
| **When it is off or fails** | The deterministic matcher is used, and the page says so (D-112) |

## What the AI does and doesn't do

The AI suggests, the user confirms, and EventOps's own rules decide what is saved.

| AI is used for | AI is never used for |
| --- | --- |
| Which list the columns look like (attendees or suppliers) | Authorization or roles |
| Which EventOps field each column goes into | Validating or changing any row |
| | Money: quotes, payments, budgets (never imported at all) |
| | Accessibility readiness, impact detection, Event Health |
| | Writing to the database |

## The pipeline

```
upload (CSV or .xlsx, read in memory, never stored)
  → parse (own CSV parser; own .xlsx reader, values only)
  → column types and keyword rules (deterministic; always run)
  → AI suggestion (only if turned on): headers, types, ≤ 3 sample values per column, ≤ 40 chars
  → schema validation of the AI's answer (strict JSON shape)
  → business validation of the AI's answer (the import type's own mapping rules)
  → human confirmation: the user reviews and can change every column, then previews every row
  → deterministic row validation (the add form's rules, duplicates)
  → human confirmation: "Import N attendees / suppliers"
  → database: one transaction and one Activity entry
```

If the AI's answer fails either check, it is ignored as a whole and the deterministic suggestion is
shown instead: "Matched by rules: the AI suggestion didn't pass our checks". If the model is off,
unreachable, answers with an HTTP error, or takes longer than 20 seconds: "Matched by rules: AI
wasn't available". An AI suggestion is labelled "Suggested by AI", with the model's name, above the
matching and under each column it matched.

### Schema validation (D-111)

The answer must be JSON exactly in this shape, or it is refused:

```json
{ "looksLike": "attendees", "columns": [{ "index": 0, "field": "name" }] }
```

`looksLike` is `attendees` or `suppliers`; `index` is a whole number from 0 to 49; `field` is a
short string or `null`; no other keys. The same shape is sent to Ollama as its `format`, so the
model is constrained to it, but the server checks it again: the model's output is untrusted input.

### Business validation (D-111)

The answer is then checked with the same rules as a mapping chosen in the browser:

- every column index at most once, and inside the file;
- only fields of the import type the user chose (no supplier field for an attendee import);
- each field at most once;
- the required fields mapped (attendees: Name; suppliers: Name and Category).

## What the model sees, and prompt injection

The model is sent the import type and its fields, each column's header (cut to 60 characters), its
detected type, and at most 3 non-empty sample values per column (cut to 40 characters). Not the
file, not the event, not other records. The headers and samples are sent as JSON data, and the
system message tells the model to treat them as data and never follow instructions inside them.

A spreadsheet can still contain text written to mislead the model. That is why its answer can only
ever be a column matching, which is checked by fixed rules and shown to the user before anything
is saved; the worst a misleading file can do is suggest a wrong matching, which the user sees and
the row validation catches.

Sample values can be personal data (names, emails). They go only to the Ollama server you run,
over the address in `OLLAMA_URL`. Nothing is logged or stored, and the request is not retried.

## Running it locally

```sh
docker compose -f docker-compose.ollama.yml up -d
docker compose -f docker-compose.ollama.yml exec ollama ollama pull qwen2.5:7b-instruct
```

Then in `.env.local`:

```sh
AI_IMPORT_ENABLED=true
OLLAMA_URL=http://localhost:11434
# Optional; defaults to qwen2.5:7b-instruct
# OLLAMA_MODEL=qwen2.5:7b-instruct
```

The model needs about 5 GB of disk and runs on a CPU (slower) or a GPU. The first request after
starting can be slow while the model loads; past 20 seconds the import uses the rules instead and
says so, and the next upload usually gets the AI suggestion.

## Deployment

A Vercel serverless function can't run a 7B model, so the deployed app leaves `OLLAMA_URL` unset
and always uses the deterministic matcher (D-112). The import works the same way; only the
suggestion's source differs. A self-hosted Ollama server reachable from Vercel can be set in
`OLLAMA_URL` later; nothing else changes.

## Tests

`import/infrastructure/extractors/llm-extractor.test.ts` runs the suggester against a fake model
server: a valid answer, invalid JSON, the wrong shape, extra keys, an unknown type, an HTTP error,
a timeout and a server that is down. `import/application/suggest-columns.test.ts` covers the
business checks and the fallback. `import/import.db.test.ts` runs whole imports with the fake server
answering, failing and refusing. The tests never call a real model; a real Ollama import is a manual
check (docs/testing.md).