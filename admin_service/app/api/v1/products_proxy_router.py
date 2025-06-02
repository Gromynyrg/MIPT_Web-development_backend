from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Body, UploadFile
from fastapi.responses import JSONResponse
from typing import Any, List, Optional, Dict
import httpx
import json

from app.config import settings
from app.auth import get_current_active_admin
from app.schemas import User as AdminUserSchema

router = APIRouter(
    prefix="/admin/products",
    tags=["Admin - Products"],
    dependencies=[Depends(get_current_active_admin)]
)

PRODUCT_SERVICE_URL = settings.PRODUCT_SERVICE_INTERNAL_URL  # http://product_service:8000/api/v1


async def handle_proxy_response(response: httpx.Response) -> JSONResponse:
    try:
        response_data = response.json()
        return JSONResponse(content=response_data, status_code=response.status_code)
    except json.JSONDecodeError:
        error_detail = f"Invalid JSON response from upstream service. Status: {response.status_code}. Body: {response.text[:500]}"
        print(f"ERROR: {error_detail}")
        client_error_detail = {"detail": "Error communicating with an underlying service: received non-JSON response."}
        error_status_code = response.status_code if response.status_code >= 400 else status.HTTP_502_BAD_GATEWAY
        raise HTTPException(status_code=error_status_code, detail=client_error_detail)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_product_proxy(request: Request, current_user: AdminUserSchema = Depends(get_current_active_admin)):
    target_url = f"{PRODUCT_SERVICE_URL}/products/"

    form_data_from_frontend = await request.form()  # Это объект FormData

    files_for_httpx: List[tuple[str, tuple[str, bytes, str]]] = []  # Список для файлов (ключ, (имя_файла, байты, тип))
    data_for_httpx: Dict[str, str] = {}  # Словарь для обычных данных формы

    # Перебираем элементы FormData
    for key in form_data_from_frontend:
        value = form_data_from_frontend.getlist(
            key)  # Используем getlist для полей, которые могут быть множественными (как images)

        # В нашем случае 'images' - это ключ для файлов
        if key == "images":  # Или тот ключ, который фронтенд использует для файлов
            for file_obj in value:  # value будет списком UploadFile объектов
                if isinstance(file_obj, UploadFile):
                    content = await file_obj.read()
                    # Для Product Service, который ожидает List[UploadFile] = File(...) под именем 'images',
                    # мы должны передать несколько файлов с одним и тем же ключом 'images'.
                    files_for_httpx.append((key, (file_obj.filename, content, file_obj.content_type)))
                    await file_obj.close()
                else:
                    # Это странно, если под ключом 'images' пришло не UploadFile
                    print(f"Warning: received non-UploadFile data for key '{key}': {type(file_obj)}")
        else:
            # Для обычных полей формы. getlist вернет список, даже если значение одно. Берем первое.
            if value:
                data_for_httpx[key] = value[0]
            else:
                data_for_httpx[key] = ""  # Или None, если Pydantic в ProductService это обработает

    print(f"Admin Proxy: Forwarding POST to {target_url}")
    print(f"Admin Proxy: Data for httpx: {data_for_httpx.keys()}")
    print(
        f"Admin Proxy: Files for httpx count: {len(files_for_httpx)} (key: '{files_for_httpx[0][0] if files_for_httpx else 'N/A'}')")

    async with httpx.AsyncClient() as client:
        try:
            # Если файлов нет, files_for_httpx будет пустым, httpx отправит только data
            response = await client.post(target_url, data=data_for_httpx,
                                         files=files_for_httpx if files_for_httpx else None)

            print(f"Admin Proxy: Received status {response.status_code} from {target_url} after POST")
            response.raise_for_status()
            return await handle_proxy_response(response)
        # ... (остальная обработка ошибок как была) ...
        except httpx.HTTPStatusError as e:
            error_detail = "Unknown error from product service."
            try:
                error_detail = e.response.json()
            except json.JSONDecodeError:
                error_detail = {"detail": e.response.text[:500]}
            print(f"Admin Proxy: HTTPStatusError from Product Service: {e.response.status_code} - {error_detail}")
            raise HTTPException(status_code=e.response.status_code, detail=error_detail)
        except httpx.RequestError as e:
            print(f"Admin Proxy: RequestError connecting to Product Service: {str(e)}")
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                                detail=f"Product service is unavailable: {str(e)}")
        except Exception as e:
            print(f"Admin Proxy: Generic error during product creation proxy: {type(e).__name__} - {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Error proxying product creation request.")


@router.get("/")
async def get_all_products_proxy(request: Request, current_user: AdminUserSchema = Depends(get_current_active_admin)):
    params = request.query_params
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{PRODUCT_SERVICE_URL}/products/", params=params)
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                                detail="Product service is unavailable.")
        except json.JSONDecodeError:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Invalid JSON response from product service.")


@router.get("/{product_id}")
async def get_product_by_id_proxy(product_id: str, current_user: AdminUserSchema = Depends(get_current_active_admin)):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{PRODUCT_SERVICE_URL}/products/{product_id}")
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        # ... (обработка ошибок как выше) ...
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                                detail="Product service is unavailable.")
        except json.JSONDecodeError:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Invalid JSON response from product service.")


@router.put("/{product_id}")
async def update_product_proxy(product_id: str, request: Request,
                               current_user: AdminUserSchema = Depends(get_current_active_admin)):
    product_data = await request.json()
    async with httpx.AsyncClient() as client:
        try:
            response = await client.put(f"{PRODUCT_SERVICE_URL}/products/{product_id}", json=product_data)
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        # ... (обработка ошибок) ...
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                                detail="Product service is unavailable.")
        except json.JSONDecodeError:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Invalid JSON response from product service.")


@router.delete("/{product_id}", status_code=status.HTTP_200_OK)  # Или 204, если Product Service возвращает 204
async def delete_product_proxy(product_id: str, current_user: AdminUserSchema = Depends(get_current_active_admin)):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.delete(f"{PRODUCT_SERVICE_URL}/products/{product_id}")
            response.raise_for_status()
            # Если Product Service возвращает тело ответа (удаленный объект), пересылаем его
            # Если 204 No Content, то response.json() вызовет ошибку.
            if response.status_code == status.HTTP_204_NO_CONTENT:
                return Response(status_code=status.HTTP_204_NO_CONTENT)
            return JSONResponse(content=response.json(), status_code=response.status_code)
        # ... (обработка ошибок) ...
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                                detail="Product service is unavailable.")
        except json.JSONDecodeError:  # Если ожидался JSON, а его нет (например, при 204)
            if response.status_code == status.HTTP_204_NO_CONTENT:  # Явная проверка
                return Response(status_code=status.HTTP_204_NO_CONTENT)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Invalid JSON response from product service.")


# Прокси для загрузки изображений к существующему товару
@router.post("/{product_id}/images/", status_code=status.HTTP_201_CREATED)
async def upload_product_images_proxy(product_id: str, request: Request,
                                      current_user: AdminUserSchema = Depends(get_current_active_admin)):
    """
    Прокси для загрузки изображений к товару.
    Пересылает multipart/form-data запрос в Product Service.
    """

    async with httpx.AsyncClient() as client:
        try:
            form_data = await request.form()  # Это даст нам обычные поля формы
            files_to_send = []

            content = await request.body()
            headers = {
                k: v for k, v in request.headers.items()
                if k.lower() not in ['host', 'content-length', 'transfer-encoding', 'connection']
            }

            target_url = f"{PRODUCT_SERVICE_URL}/products/{product_id}/images/"
            response = await client.post(target_url, content=content, headers=headers)

            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Product service unavailable.")
        except Exception as e:  # Общий перехват
            print(f"Error proxying image upload: {e}")
            raise HTTPException(status_code=500, detail="Failed to proxy image upload.")


@router.delete("/images/{image_id}", status_code=status.HTTP_200_OK)  # Или 204
async def delete_product_image_proxy(image_id: str, current_user: AdminUserSchema = Depends(get_current_active_admin)):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.delete(f"{PRODUCT_SERVICE_URL}/products/images/{image_id}")
            response.raise_for_status()
            if response.status_code == status.HTTP_204_NO_CONTENT:
                return Response(status_code=status.HTTP_204_NO_CONTENT)
            return JSONResponse(content=response.json(), status_code=response.status_code)
        # ... (обработка ошибок) ...
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except httpx.RequestError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                                detail="Product service is unavailable.")
        except json.JSONDecodeError:
            if response.status_code == status.HTTP_204_NO_CONTENT:
                return Response(status_code=status.HTTP_204_NO_CONTENT)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Invalid JSON response from product service.")