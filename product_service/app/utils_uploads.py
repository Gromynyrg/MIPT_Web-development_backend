import uuid
import shutil
import os
from pathlib import Path
from fastapi import UploadFile, HTTPException, status

from .config import PRODUCT_IMAGES_DIR, STATIC_FILES_DIR  # Пути из config.py


# СИНХРОННЫЙ хелпер для сохранения файла и получения его относительного URL
def save_upload_file_sync(file: UploadFile, entity_id_for_filename: uuid.UUID) -> tuple[
    Path, str]:  # <--- Обновляем тип возвращаемого значения
    print(f"--- Attempting to save file: {file.filename} for entity {entity_id_for_filename}")
    print(f"PRODUCT_IMAGES_DIR: {PRODUCT_IMAGES_DIR}")
    if not os.path.exists(PRODUCT_IMAGES_DIR):
        print(f"ERROR: PRODUCT_IMAGES_DIR {PRODUCT_IMAGES_DIR} does not exist!")
        raise IOError(f"Upload directory does not exist: {PRODUCT_IMAGES_DIR}")
    elif not os.access(PRODUCT_IMAGES_DIR, os.W_OK):
        print(f"ERROR: No write access to PRODUCT_IMAGES_DIR {PRODUCT_IMAGES_DIR}")
        raise IOError(f"No write access to upload directory: {PRODUCT_IMAGES_DIR}")

    allowed_content_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_content_types:
        raise ValueError(
            f"Invalid image type for {file.filename}. Allowed: {', '.join(allowed_content_types)}"
        )

    try:
        file_extension = Path(file.filename).suffix.lower()
        if not file_extension or file_extension not in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
            raise ValueError(f"Invalid file extension for {file.filename}. Supported: .jpg, .jpeg, .png, .gif, .webp")
    except Exception:
        raise ValueError(f"Could not determine file extension for {file.filename}.")

    new_filename = f"{entity_id_for_filename}_{uuid.uuid4()}{file_extension}"
    file_path = Path(PRODUCT_IMAGES_DIR) / new_filename  # file_path это объект Path

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"File {file.filename} successfully saved to {file_path}")  # Лог успешного сохранения
    except Exception as e:
        print(f"ERROR saving file {file.filename} to {file_path}: {e}")  # Лог ошибки сохранения
        raise IOError(f"Could not save image file {file.filename}: {str(e)}") from e
    finally:
        if hasattr(file, 'file') and hasattr(file.file, 'close') and callable(file.file.close):
            file.file.close()

    relative_path_to_static_root = file_path.relative_to(Path(STATIC_FILES_DIR))
    public_image_url = f"/static/{str(relative_path_to_static_root).replace(os.path.sep, '/')}"

    return file_path, public_image_url  # <--- ВОЗВРАЩАЕМ КОРТЕЖ: (путь_к_файлу, публичный_url)


# Асинхронный хелпер (если понадобится для эндпоинтов, не вызывающих синхронный CRUD)
async def save_upload_file_async(file: UploadFile, entity_id_for_filename: uuid.UUID) -> str:
    # Логика почти такая же, как в синхронной, но с await file.close()
    allowed_content_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_content_types:
        raise HTTPException(  # Здесь можно бросать HTTPException, т.к. это для API слоя
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image type for {file.filename}. Allowed: {', '.join(allowed_content_types)}"
        )
    # ... остальная логика генерации имени и пути ...
    file_extension = Path(file.filename).suffix.lower()
    if not file_extension or file_extension not in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Invalid file extension for {file.filename}.")

    new_filename = f"{entity_id_for_filename}_{uuid.uuid4()}{file_extension}"
    file_path = Path(PRODUCT_IMAGES_DIR) / new_filename

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save image file {file.filename}: {str(e)}"
        )
    finally:
        await file.close()  # Используем await для async функции

    relative_path_to_static_root = file_path.relative_to(Path(STATIC_FILES_DIR))
    public_image_url = f"/static/{str(relative_path_to_static_root).replace(os.path.sep, '/')}"
    return public_image_url


def delete_physical_image(image_url: str):
    if not image_url or not image_url.startswith("/static/"):
        print(f"Skipping deletion of invalid or non-local image URL: {image_url}")
        return False

    relative_file_path_from_static = image_url.replace("/static/", "", 1)
    file_to_delete_path = Path(STATIC_FILES_DIR) / relative_file_path_from_static

    if file_to_delete_path.exists():
        try:
            os.remove(file_to_delete_path)
            print(f"Successfully deleted physical file: {file_to_delete_path}")
            return True
        except Exception as e:
            print(f"Error deleting physical file {file_to_delete_path}: {e}")
            # Логируем ошибку, но не прерываем операцию в БД (можно решить иначе)
            return False
    else:
        print(f"Physical file not found for deletion: {file_to_delete_path}")
        return False