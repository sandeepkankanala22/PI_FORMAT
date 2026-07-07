# ForecastIQ – AI Forecasting Agent

An AI-powered commercial forecasting tool for pharmaceutical products. It guides users through building multi-country, multi-year revenue forecasts using an epidemiology-driven patient funnel model, backed by a multi-agent pipeline (LangGraph) that can also generate the results as a formatted Excel workbook and PowerPoint deck. An embedded AI copilot (AWS Bedrock / Claude) answers questions and provides benchmark suggestions throughout the flow.

---

## Architecture

- **Frontend** — `frontend-next/` (Next.js, static export). Built to `frontend-next/out` and served directly by the backend.
- **Backend** — FastAPI app in `backend/server.py`, with `forecast_server.py` as the thin uvicorn entrypoint.
- **Agents** — `agents/` and `excel_agent/` contain the LangGraph-based multi-agent pipeline (decomposer, critic, styling, math, data, coordinator, PPTX agent) that turns forecast inputs into an Excel workbook / PPTX deck.
- **LLM** — AWS Bedrock (Claude models). Configured via `MODEL_ID` / `MODEL_ID_CODER`.
- **Storage** — Optional S3 for saved inputs, run outputs, and logs.

---

## Prerequisites

- Python 3.11
- Node.js 20 (for building the frontend)
- AWS credentials with Bedrock access (and S3, if `S3_BUCKET` is set)

---

## Local Development

1. **Install backend dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

2. **Run the backend:**

   ```bash
   uvicorn forecast_server:app --reload --port 8000
   ```

3. **Run the frontend (separate terminal):**

   ```bash
   cd frontend-next
   npm install
   npm run dev
   ```

   The Next.js dev server proxies `/api/*` requests to `http://127.0.0.1:8000`. Open `http://localhost:3000`.

---

## Production Build

The `Dockerfile` builds the Next.js static export and runs the backend in a single container:

```bash
docker build -t forecasting-agent .
docker run -p 8000:8000 forecasting-agent
```

The backend serves the built frontend directly from `frontend-next/out`, so there is only one port (`8000`) in production.

---

## Deployment

Deployed to **AWS App Runner**. `apprunner.yaml` defines a source-based build that installs Python dependencies, installs Node 20, and builds the Next.js frontend (`npm ci && npm run build`) before starting the app with:

```bash
python3 -m uvicorn forecast_server:app --host 0.0.0.0 --port 8000
```

Key environment variables are set in `apprunner.yaml` (model IDs, agent temperatures, prompt/output/log paths, S3 config, etc.).

---

## Key Endpoints

| Endpoint | Description |
|---|---|
| `GET /` | Serves the Next.js frontend |
| `GET /health` | Liveness check + Bedrock connectivity check |
| `POST /api/chat` | Bedrock-powered chat assistant |
| `POST /api/research` | Bedrock-powered epidemiology / market research |
| `POST /api/recommend` | Parameter/benchmark recommendations |
| `POST /api/forecast` | Run the patient funnel forecast |
| `POST /api/sensitivity` | Sensitivity analysis on forecast inputs |
| `POST /api/agent` | Kick off the multi-agent Excel generation run |
| `GET /api/agent/status` | Poll status of an agent run |
| `GET /preview_excel` | Excel viewer page |
| `GET /prompt-editor` | Prompt studio for editing agent prompts |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MODEL_ID` | No | Bedrock model ID for chat/agents (defaults set in `apprunner.yaml`) |
| `MODEL_ID_CODER` | No | Bedrock model ID used for code/Excel generation steps |
| `AWS_REGION` | No | AWS region for Bedrock (defaults to `us-east-1`) |
| `S3_BUCKET` | No | Enables S3 for saved inputs, run outputs, and logs |
| `S3_PREFIX` | No | S3 key prefix (default `forecast-agent`) |
| `S3_REGION` | No | S3 region (defaults to `AWS_REGION`) |
| `MODEL_ID_PI_EXTRACT` | No | Bedrock model for Product Information auto-fill (defaults to `MODEL_ID`) |
| `PI_EXTRACT_MAX_FILE_SIZE_MB` | No | Max upload size for PI extraction (default `15`) |
| `PI_EXTRACT_TEXT_CHAR_LIMIT` | No | Max cleaned text chars sent to Bedrock (default `12000`) |
| `PI_EXTRACT_CHUNK_SIZE` | No | Chunk window size for large documents (default `4000`) |
| `PI_EXTRACT_BEDROCK_TIMEOUT` | No | Bedrock read timeout in seconds for PI extraction (default `30`) |
| `PI_EXTRACT_MAX_TOKENS` | No | Max LLM output tokens for PI extraction JSON (default `512`) |

## Attribution

- Navbar user icon inspired by [User icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/user)
