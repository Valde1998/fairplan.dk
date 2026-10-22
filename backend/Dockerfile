FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend backend
COPY database database

EXPOSE 5002
CMD ["sh", "-c", "python -m backend.seed && exec waitress-serve --listen=0.0.0.0:5002 --call backend.app:create_app"]
