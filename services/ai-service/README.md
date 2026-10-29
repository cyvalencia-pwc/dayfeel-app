# DayFeel AI service (OpenAI)

FastAPI adapter for the companion, safety screening, community moderation APIs. Uses the OpenAI Python SDK, Responses API with Pydantic Structured Outputs, and `omni-moderation-latest`. The text model defaults to `gpt-4.1-mini` and can be set with `OPENAI_MODEL` to a model supporting Responses Structured Outputs.

## Start on Windows (CMD)

Python 3.11+ is required; this implementation was tested with the installed Python 3.14.

```bat
cd /d C:\Users\cvalencia022\Documents\Workspaces\Capstone\dayfeel\services\ai-service
py -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
if not exist .env copy .env.example .env
notepad .env
```

Set `OPENAI_API_KEY` to your own OpenAI API key. Leave it only in this ignored server-side `.env`, never in a `VITE_` variable or frontend source. The key needs API access and billing/quota for the configured model. ChatGPT subscriptions do not configure this service. `INTERNAL_KEY` must match content-service and identity-service. Identity must be running at `IDENTITY_URL` to validate users and fresh consent.

```bat
.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000 --no-access-log
```

Keep that terminal running. `/health` is a liveness check, not a paid OpenAI readiness probe. No model request happens at startup. The server fails startup with a configuration error if the OpenAI key is missing. Provider authentication, model access, quota and timeout failures become generic 503 responses; provider details and text are not returned or logged by this adapter.

In content-service, keep `AI_URL=http://127.0.0.1:8000`. Rebuild and restart content-service after the timeout/history changes:

```bat
cd ..\content-service
npm run build
npm start
```

Then sign in to DayFeel, open Companion, choose **New conversation**, and send **What is a simple grounding exercise I can try?** A successful live reply appears after your message. If a previous send failed, the user message may already have been saved; sending again creates another turn. The frontend allows 90 seconds for a companion request. Do not start a second content-service instance on an occupied port; stop the old instance first.

## Internal routes

Every POST requires both `X-Internal-Key` and `Authorization: Bearer ...`. User JWTs are validated through identity-service on every request (including status, expiry and token version).

| Route | Input | Output |
| --- | --- | --- |
| `/safety/crisis-check` | `{text}` | `{riskLevel: LOW/MEDIUM/HIGH}` |
| `/companion/chat` | `{messages:[{role,content}], context?, summary?, disclaimer?}` | `{reply}` |
| `/moderate` | `{text}` | `{verdict: OK/TOXIC/SPAM/SELF_HARM_RISK}` |

Companion screens the latest message before generation, returns a fixed support response for flagged self-harm content, and screens generated replies before returning them. A moderation outage fails closed for companion generation. Content-service retains its existing crisis handling and keyword fallback; this is not a validated clinical screening system. Memory context and summaries are forwarded only with fresh opt-in; a withdrawal detected after generation discards that reply. Requests have bounded history, output size, deadlines and concurrent OpenAI calls. There are no model tools or external browsing capabilities.

The adapter stores no user text. Responses calls set `store=False`; this does not assert zero provider retention. Read OpenAI's data controls for the applicable account policy. User conversation text is sent to OpenAI when the user uses the companion, and to the moderation endpoint for screening. Optional historical journal/mood memory remains consent-gated.

Journal emotion analysis and weekly insights have been removed. Companion and community moderation use the remaining HTTP routes directly.

## Tests and contract

If OpenAI connections fail with `CERTIFICATE_VERIFY_FAILED`, this service uses the operating system's trusted certificates with verification enabled. Restart the service after updating it. If your network requires a custom CA not installed in the Windows trust store, obtain its trusted PEM bundle from your administrator and set `SSL_CERT_FILE` to its full path in the AI `.env`. Do not disable TLS verification.

```bat
.venv\Scripts\python.exe -m pytest test_app.py -q
```

Tests mock provider and identity responses; no real API key, paid calls or private text is sent. They cover authorization, fresh consent, crisis short-circuit, provider failure/refusal, output moderation, input validation, moderation and candidate filtering. The generated OpenAPI contract is `docs/openapi/ai-service.json`.

Official references: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Moderation](https://developers.openai.com/api/docs/guides/moderation).
