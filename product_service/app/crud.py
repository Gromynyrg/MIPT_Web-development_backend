from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
import uuid
import os
from fastapi import UploadFile

from . import models, schemas
from .utils_uploads import save_upload_file_sync


# --- ProductImage CRUD ---
def create_db_product_image(db: Session, image_data: schemas.ProductImageCreate,
                            product_id: uuid.UUID) -> models.ProductImage:
    # Эта функция только создает объект модели и добавляет в сессию, НЕ коммитит.
    db_image = models.ProductImage(product_id=product_id, image_url=image_data.image_url)
    db.add(db_image)
    return db_image


def get_db_product_image(db: Session, product_image_id: uuid.UUID) -> Optional[models.ProductImage]:
    return db.query(models.ProductImage).filter(models.ProductImage.product_image_id == product_image_id).first()


def delete_db_product_image(db: Session, product_image_id: uuid.UUID) -> Optional[models.ProductImage]:
    db_image = get_db_product_image(db, product_image_id)
    if db_image:
        db.delete(db_image)
    return db_image


# --- Product CRUD ---
def get_product_by_id(db: Session, product_id: uuid.UUID) -> Optional[models.Product]:
    return db.query(models.Product).filter(models.Product.product_id == product_id).first()


def get_product_by_article(db: Session, article: str) -> Optional[models.Product]:
    return db.query(models.Product).filter(models.Product.article == article).first()


def get_product_by_name(db: Session, name: str) -> Optional[models.Product]:
    return db.query(models.Product).filter(models.Product.name == name).first()


def get_all_products(db: Session, skip: int = 0, limit: int = 20) -> List[models.Product]:
    return db.query(models.Product).offset(skip).limit(limit).all()


def create_product(db: Session, product_data: schemas.ProductCreate,
                   image_files: Optional[List[UploadFile]] = None) -> models.Product:
    # Предварительные проверки уникальности
    if get_product_by_article(db, article=product_data.article):
        raise ValueError(f"Product with article '{product_data.article}' already exists (pre-check).")
    if get_product_by_name(db, name=product_data.name):
        raise ValueError(f"Product with name '{product_data.name}' already exists (pre-check).")

    db_product = models.Product(**product_data.model_dump())
    db.add(db_product)

    physically_saved_files_info: List[tuple[Path, str]] = []  # (path, url)
    created_image_models_in_session = []

    try:
        print(f"CRUD: Flushing product {db_product.article} with id {db_product.product_id}")
        db.flush()
        db.refresh(db_product)  # Обновляем объект, чтобы получить все поля из БД (если есть default/triggers)
        print(f"CRUD: Product {db_product.article} flushed, product_id: {db_product.product_id}")

        if image_files:
            print(f"CRUD: Processing {len(image_files)} image files for product {db_product.product_id}")
            for file_to_upload in image_files:
                print(f"CRUD: Saving file {file_to_upload.filename}")
                full_file_path, public_url = save_upload_file_sync(
                    file=file_to_upload,
                    entity_id_for_filename=db_product.product_id
                )
                physically_saved_files_info.append((full_file_path, public_url))
                print(f"CRUD: File {file_to_upload.filename} saved to {full_file_path}, URL: {public_url}")

                image_schema = schemas.ProductImageCreate(image_url=public_url)
                img_model = create_db_product_image(db=db, image_data=image_schema, product_id=db_product.product_id)
                created_image_models_in_session.append(img_model)
                print(f"CRUD: ProductImage model for {public_url} added to session.")

        print("CRUD: Committing transaction for product and images.")
        db.commit()
        print("CRUD: Transaction committed.")

        db.refresh(db_product)
        for img_model in created_image_models_in_session:
            db.refresh(img_model)
        print("CRUD: Product and image models refreshed.")

    except Exception as e:
        print(f"CRUD: EXCEPTION OCCURRED: {type(e).__name__} - {str(e)}")
        db.rollback()  # Откатываем транзакцию БД
        print("CRUD: Transaction rolled back.")

        for f_path, _ in physically_saved_files_info:
            if f_path.exists():
                try:
                    os.remove(f_path)
                    print(f"CRUD: Cleaned up physical file {f_path}")
                except Exception as e_del:
                    print(f"CRUD: ERROR cleaning up file {f_path}: {e_del}")

        if isinstance(e, IntegrityError):
            detail = "Database integrity error (e.g., duplicate article/name)."
            # Попытка получить более конкретную информацию об ошибке уникальности
            if hasattr(e.orig, 'diag') and hasattr(e.orig.diag, 'constraint_name'):
                constraint_name = e.orig.diag.constraint_name
                detail += f" Violated constraint: {constraint_name}."
            elif "products_article_key" in str(e.orig).lower():
                detail = f"Product article '{product_data.article}' already exists."
            elif "products_name_key" in str(e.orig).lower():
                detail = f"Product name '{product_data.name}' already exists."
            raise ValueError(detail) from e
        elif isinstance(e, (IOError, ValueError)):  # Ошибки от save_upload_file_sync
            raise ValueError(f"Error processing product/image data: {str(e)}") from e
        else:  # Другие непредвиденные ошибки
            raise RuntimeError(f"An unexpected error occurred during product creation: {str(e)}") from e

    return db_product


def update_existing_product(db: Session, product_id: uuid.UUID, product_update_data: schemas.ProductUpdate) -> Optional[
    models.Product]:
    db_product = get_product_by_id(db, product_id=product_id)
    if not db_product:
        return None

    update_data = product_update_data.model_dump(exclude_unset=True)

    if "article" in update_data and update_data["article"] != db_product.article:
        if get_product_by_article(db, article=update_data["article"]):
            raise ValueError(f"Another product with article '{update_data['article']}' already exists.")
    if "name" in update_data and update_data["name"] != db_product.name:
        if get_product_by_name(db, name=update_data["name"]):
            raise ValueError(f"Another product with name '{update_data['name']}' already exists.")

    for key, value in update_data.items():
        setattr(db_product, key, value)

    try:
        db.commit()
        db.refresh(db_product)
    except IntegrityError as e:
        db.rollback()
        # ... (обработка IntegrityError как в create_product) ...
        raise ValueError("Could not update product due to DB integrity error.") from e
    return db_product


def delete_product_by_id(db: Session, product_id: uuid.UUID) -> Optional[models.Product]:
    db_product = get_product_by_id(db, product_id)
    if db_product:
        # Физическое удаление файлов изображений должно происходить в API слое до вызова этого
        db.delete(db_product)  # SQLAlchemy cascade удалит записи из product_images
        db.commit()
    return db_product