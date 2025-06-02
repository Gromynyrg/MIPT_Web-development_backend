from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import JSONResponse
import httpx
import json

from app.config import settings
from app.auth import get_current_active_admin
from app.schemas import User as AdminUserSchema

router = APIRouter(
    prefix="/admin/orders",
    tags=["Admin - Orders"],
    dependencies=[Depends(get_current_active_admin)]
)

ORDER_SERVICE_URL = settings.ORDER_SERVICE_INTERNAL_URL # http://order_service:8000/api/v1

# Прокси для получения всех заказов
@router.get("/")
async def get_all_orders_proxy(request: Request, current_user: AdminUserSchema = Depends(get_current_active_admin)):
    params = request.query_params
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{ORDER_SERVICE_URL}/orders/", params=params)
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Order service is unavailable.")
        except json.JSONDecodeError:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid JSON response from order service.")


# Прокси для получения заказа по ID
@router.get("/{order_id}")
async def get_order_by_id_proxy(order_id: str, current_user: AdminUserSchema = Depends(get_current_active_admin)):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{ORDER_SERVICE_URL}/orders/{order_id}")
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        # ... (обработка ошибок как выше) ...
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Order service is unavailable.")
        except json.JSONDecodeError:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid JSON response from order service.")

# Прокси для изменения статуса заказа
@router.patch("/{order_id}/status")
async def update_order_status_proxy(order_id: str, request: Request, current_user: AdminUserSchema = Depends(get_current_active_admin)):
    status_data = await request.json() # Ожидаем {"status": "NEW_STATUS"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.patch(f"{ORDER_SERVICE_URL}/orders/{order_id}/status", json=status_data)
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        # ... (обработка ошибок) ...
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Order service is unavailable.")
        except json.JSONDecodeError:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid JSON response from order service.")


# Прокси для CRUD промокодов (если нужно через админку)
@router.post("/promocodes/", status_code=status.HTTP_201_CREATED)
async def create_promocode_proxy(request: Request, current_user: AdminUserSchema = Depends(get_current_active_admin)):
    promocode_data = await request.json()
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{ORDER_SERVICE_URL}/promocodes/", json=promocode_data)
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        # ... (обработка ошибок)
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Order service unavailable.")
        except json.JSONDecodeError:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid JSON response from order service.")

