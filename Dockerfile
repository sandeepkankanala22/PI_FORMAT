FROM python:3.11-slim

WORKDIR /app

# Install Node.js 20
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Build Next.js frontend
RUN cd frontend-next && npm ci && npm run build

EXPOSE 8000

CMD ["python3", "-m", "uvicorn", "forecast_server:app", "--host", "0.0.0.0", "--port", "8000"]
