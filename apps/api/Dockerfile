FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY modeldoctor_api ./modeldoctor_api
CMD ["uvicorn", "modeldoctor_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
