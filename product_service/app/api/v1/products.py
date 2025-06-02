from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from math import ceil

from app import crud, models, schemas
from app.db import get_db
from app.utils_uploads import save_upload_file_sync, save_upload_file_async, delete_physical_image

router = APIRouter(
    prefix="/products",
    tags=["Products"],
)


@router.post("/", response_model=schemas.Product, status_code=status.HTTP_201_CREATED)
async def api_create_product_with_images(
        product_form_data: schemas.ProductCreateForm = Depends(schemas.ProductCreateForm.as_form),
        images: Optional[List[UploadFile]] = File(None, description="Файлы изображений товара (опционально)"),
        db: Session = Depends(get_db)
):
    product_create_schema = schemas.ProductCreate(**product_form_data.model_dump())

    try:
        # Вызываем обновленный CRUD, который сам обрабатывает файлы
        db_product = crud.create_product(
            db=db,
            product_data=product_create_schema,
            image_files=images if images else []
        )
    except ValueError as e:  # Ошибки валидации, сохранения файлов, IntegrityError от CRUD
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:  # Непредвиденные ошибки от CRUD
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:  # Любые другие непредвиденные ошибки
        # Логируем неизвестную ошибку
        print(f"API: UNEXPECTED ERROR during product creation: {type(e).__name__} - {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="An unexpected server error occurred.")

    return db_product


@router.get("/", response_model=schemas.ProductListResponse)  # Используем новую схему ответа
def api_read_products(
        skip: int = Query(0, ge=0, description="Количество пропускаемых записей"),
        limit: int = Query(20, ge=1, le=100, description="Максимальное количество записей"),
        search: Optional[str] = Query(None, description="Строка для поиска по названию или артикулу"),  # Для поиска
        technology: Optional[models.LampTechnologyEnum] = Query(None, description="Фильтр по технологии лампы (например, Светодиодная, Накаливания)"),
        db: Session = Depends(get_db)
):
    products_models, total_count = crud.get_all_products(db, skip=skip, limit=limit, search_term=search, technology=technology)

    items_response = []
    for p in products_models:
        main_image_url = p.images[0].image_url if p.images else None
        items_response.append(schemas.ProductInList(
            product_id=p.product_id, name=p.name, article=p.article,
            price=p.price, main_image_url=main_image_url
        ))

    current_page = (skip // limit) + 1 if limit > 0 else 1
    total_pages = ceil(total_count / limit) if limit > 0 else 1

    return schemas.ProductListResponse(
        items=items_response,
        total_count=total_count,
        page=current_page,
        limit=limit,
        pages=total_pages
    )


@router.get("/{product_id}", response_model=schemas.Product)
def api_read_product(product_id: uuid.UUID, db: Session = Depends(get_db)):
    db_product = crud.get_product_by_id(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return db_product


@router.put("/{product_id}", response_model=schemas.Product)
def api_update_product(
        product_id: uuid.UUID, product_update_data: schemas.ProductUpdate, db: Session = Depends(get_db)
):
    # Этот эндпоинт НЕ обновляет изображения. Только данные товара.
    try:
        updated_product = crud.update_existing_product(db=db, product_id=product_id,
                                                       product_update_data=product_update_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if updated_product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return updated_product


@router.delete("/{product_id}", response_model=schemas.Product)  # или status_code=204
def api_delete_product(product_id: uuid.UUID, db: Session = Depends(get_db)):
    db_product = crud.get_product_by_id(db, product_id=product_id)  # Получаем товар ДО удаления
    if db_product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    # Собираем URL изображений для физического удаления
    image_urls_to_delete = [img.image_url for img in db_product.images]

    deleted_product_from_db = crud.delete_product_by_id(db=db, product_id=product_id)

    if deleted_product_from_db:
        for url in image_urls_to_delete:
            delete_physical_image(url)

    return db_product


# --- Эндпоинты для управления изображениями существующего товара ---
@router.post("/{product_id}/images/", response_model=List[schemas.ProductImage], status_code=status.HTTP_201_CREATED)
async def api_upload_additional_images(
        product_id: uuid.UUID,
        files: List[UploadFile] = File(...),
        db: Session = Depends(get_db)
):
    db_product = crud.get_product_by_id(db, product_id=product_id)
    if not db_product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    created_db_images = []
    physically_saved_image_urls_for_cleanup = []

    try:
        for file_to_upload in files:
            public_url = await save_upload_file_async(file_to_upload, product_id)
            physically_saved_image_urls_for_cleanup.append(public_url)

            image_schema = schemas.ProductImageCreate(image_url=public_url)
            img_model = crud.create_db_product_image(db=db, image_data=image_schema, product_id=product_id)
            created_db_images.append(img_model)

        db.commit()
        for img_model in created_db_images:  # Обновляем каждую модель, чтобы получить сгенерированные БД поля (product_image_id, upload_at)
            db.refresh(img_model)
    except (ValueError, IOError) as e:
        db.rollback()
        for url in physically_saved_image_urls_for_cleanup:
            delete_physical_image(url)
        detail_msg = str(e)
        if isinstance(e, ValueError):  # Ошибка валидации типа файла
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail_msg)
        else:  # IOError
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail=f"Failed to save image: {detail_msg}")
    except Exception as e_db:  # Другие ошибки БД
        db.rollback()
        for url in physically_saved_image_urls_for_cleanup:
            delete_physical_image(url)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Database or unexpected error: {str(e_db)}")

    return created_db_images


@router.delete("/images/{image_id}", response_model=schemas.ProductImage)
def api_delete_image(image_id: uuid.UUID, db: Session = Depends(get_db)):
    db_image = crud.get_db_product_image(db=db, product_image_id=image_id)
    if not db_image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    image_url_to_delete = db_image.image_url

    crud.delete_db_product_image(db=db, product_image_id=image_id)
    db.commit()

    delete_physical_image(image_url_to_delete)

    return db_image