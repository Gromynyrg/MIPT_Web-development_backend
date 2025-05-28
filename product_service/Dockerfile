FROM ubuntu:latest
LABEL authors="kykab"

ENTRYPOINT ["top", "-b"]# Используем официальный образ Python
FROM python:3.11-slim

# Устанавливаем рабочую директорию в контейнере
WORKDIR /app/product_service

# Копируем файл зависимостей и устанавливаем их
# Это делается отдельным слоем для кэширования Docker
COPY ./requirements.txt /app/product_service/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Копируем все содержимое папки app (где наш код) в рабочую директорию контейнера
COPY ./app /app/product_service/app

# Указываем команду для запуска приложения
# Uvicorn будет слушать на порту 8000 внутри контейнера
# host 0.0.0.0 нужен, чтобы приложение было доступно извне контейнера
# --port 8000 - порт внутри контейнера
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]