from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
import uuid

from app import crud, schemas
from app.db import get_db

router = APIRouter(
    prefix="/promocodes",
    tags=["Promocodes"],
)


@router.post("/", response_model=schemas.Promocode, status_code=status.HTTP_201_CREATED)
def create_promocode_endpoint(promocode_in: schemas.PromocodeCreate, db: Session = Depends(get_db)):
    """
    Создать новый промокод.
    """
    try:
        return crud.create_promocode(db=db, promocode_data=promocode_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/", response_model=List[schemas.Promocode])
def read_all_promocodes_endpoint(
        skip: int = Query(0, ge=0, description="Пропустить записи"),
        limit: int = Query(100, ge=1, le=200, description="Макс. кол-во записей"),
        db: Session = Depends(get_db)
):
    """
    Получить список всех промокодов.
    """
    return crud.get_all_promocodes(db=db, skip=skip, limit=limit)


@router.get("/{promocode_id}", response_model=schemas.Promocode)
def read_promocode_by_id_endpoint(promocode_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Получить промокод по его ID.
    """
    db_promocode = crud.get_promocode_by_id(db=db, promocode_id=promocode_id)
    if db_promocode is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promocode not found")
    return db_promocode


@router.get("/name/{promocode_name}", response_model=schemas.Promocode)
def read_promocode_by_name_endpoint(promocode_name: str, db: Session = Depends(get_db)):
    """
    Получить промокод по его имени (коду).
    """
    db_promocode = crud.get_promocode_by_name(db=db, promocode_name=promocode_name)
    if db_promocode is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promocode not found")
    return db_promocode


@router.put("/{promocode_id}", response_model=schemas.Promocode)
def update_promocode_endpoint(
        promocode_id: uuid.UUID,
        promocode_in: schemas.PromocodeCreate,  # Используем схему создания для обновления
        db: Session = Depends(get_db)
):
    """
    Обновить промокод по ID. Передаются все поля для обновления.
    """
    try:
        updated_promocode = crud.update_promocode(db=db, promocode_id=promocode_id, promocode_update_data=promocode_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if updated_promocode is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promocode not found to update")
    return updated_promocode


@router.delete("/{promocode_id}", response_model=schemas.Promocode)
def delete_promocode_endpoint(promocode_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Удалить промокод по ID.
    """
    deleted_promocode = crud.delete_promocode(db=db, promocode_id=promocode_id)
    if deleted_promocode is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promocode not found to delete")
    return deleted_promocode  # Возвращаем удаленный объект