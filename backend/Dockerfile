FROM python:3.11-slim

WORKDIR /app

# Устанавливаем Python-зависимости
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Копируем исходники бэкенда
COPY . .

EXPOSE 3000

# Запускаем FastAPI-приложение
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "3000"]
