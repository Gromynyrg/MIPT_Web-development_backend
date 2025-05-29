FROM python:3.11-slim

# Устанавливаем рабочую директорию в контейнере
WORKDIR /app/order_service

# Копируем файл зависимостей и устанавливаем их
COPY ./requirements.txt /app/order_service/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Копируем все содержимое папки app (где наш код) в рабочую директорию контейнера
COPY ./app /app/order_service/app

# Указываем команду для запуска приложения
# Uvicorn будет слушать на порту 8000 внутри контейнера
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]