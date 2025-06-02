// Глобальные переменные для пагинации товаров
let currentProductsPage = 1;
const productsPerPage = 10; // Сколько товаров на странице, как в макете
let totalProductPages = 1; // Будет обновляться

// Функция для загрузки и отображения товаров
async function loadProducts(page = 1, limit = productsPerPage, searchTerm = '') {
    const productsTableContainer = document.getElementById('productsTableContainer');
    const paginationContainer = document.getElementById('productsPaginationContainer');
    const loadingMessage = "<p>Загрузка товаров...</p>";
    const errorMessage = "<p>Не удалось загрузить товары. Попробуйте позже.</p>";

    if (!productsTableContainer || !paginationContainer) {
        console.error("Products table or pagination container not found!");
        return;
    }

    productsTableContainer.innerHTML = loadingMessage;
    paginationContainer.innerHTML = ''; // Очищаем пагинацию

    try {
        let endpoint = `/admin/products?skip=${(page - 1) * limit}&limit=${limit}`;
        if (searchTerm && searchTerm.trim() !== "") { // Проверяем, что searchTerm не пустой
            endpoint += `&search=${encodeURIComponent(searchTerm.trim())}`;
        }

        const responseData = await request(endpoint); // Используем функцию из api.js

        // Теперь ожидаем объект { items: [], total_count: N, page: N, limit: N, pages: N }
        if (responseData && responseData.items && typeof responseData.total_count !== 'undefined') {
            renderProductsTable(responseData.items, productsTableContainer);

            totalProductPages = responseData.pages || Math.ceil(responseData.total_count / limit) ; // Используем pages из ответа или считаем
            currentProductsPage = responseData.page || page; // Используем page из ответа или текущую запрошенную

            renderProductsPagination(paginationContainer);
        } else {
            productsTableContainer.innerHTML = "<p>Товары не найдены или ошибка в данных.</p>";
            console.warn("Received unexpected data structure from /admin/products/", responseData);
        }
    } catch (error) {
        console.error('Error loading products:', error);
        productsTableContainer.innerHTML = errorMessage;
        if (error.status && error.data && error.data.detail) {
            // showErrorInModalOrGlobal(error.data.detail); // Нужна функция для показа ошибок
        }
    }
}

const productSearchInput = document.getElementById('productSearch');
if (productSearchInput) {
    let searchTimeout;
    productSearchInput.addEventListener('input', (event) => {
        clearTimeout(searchTimeout);
        const searchTerm = event.target.value;
        // Загрузка с задержкой, чтобы не делать запрос на каждое нажатие клавиши
        searchTimeout = setTimeout(() => {
            loadProducts(1, productsPerPage, searchTerm); // При поиске всегда начинаем с первой страницы
        }, 500); // Задержка 500 мс
    });
}

function renderProductsTable(products, container) {
    if (products.length === 0) {
        container.innerHTML = "<p>Товары не найдены.</p>";
        return;
    }

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>№</th>
                    <th>Наименование</th>
                    <th>Артикул</th>
                    <th>Кол-во</th>
                    <th>Цена</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;
    // Нумерация с учетом страницы
    const startNumber = (currentProductsPage - 1) * productsPerPage + 1;

    products.forEach((product, index) => {
        tableHTML += `
            <tr>
                <td>${startNumber + index}</td>
                <td>${escapeHtml(product.name)}</td>
                <td>${escapeHtml(product.article)}</td>
                <td>${product.stock_quantity !== null && product.stock_quantity !== undefined ? product.stock_quantity : '-'}</td>
                <td>${product.price} ₽</td>
                <td>
                    <button class="btn-table-action edit" onclick="openEditProductModal('${product.product_id}')">Изменить</button>
                    <button class="btn-table-action delete" onclick="deleteProduct('${product.product_id}')">Удалить</button>
                </td>
            </tr>
        `;
    });

    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

function renderProductsPagination(container) {
    if (totalProductPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let paginationHTML = '';
    // Кнопка "назад"
    paginationHTML += `<button onclick="loadProducts(${currentProductsPage - 1})" ${currentProductsPage === 1 ? 'disabled' : ''}><</button>`;

    // Номера страниц (упрощенная версия)
    for (let i = 1; i <= totalProductPages; i++) {
        if (i === currentProductsPage) {
            paginationHTML += `<span class="current-page">${i}</span>`;
        } else {
            paginationHTML += `<button onclick="loadProducts(${i})">${i}</button>`;
        }
    }
    // Кнопка "вперед"
    paginationHTML += `<button onclick="loadProducts(${currentProductsPage + 1})" ${currentProductsPage === totalProductPages ? 'disabled' : ''}>></button>`;
    container.innerHTML = paginationHTML;
}

function populateProductFormSelects() {
    const techSelect = document.getElementById('productTechnology');
    const energySelect = document.getElementById('productEnergyClass');

    if (!techSelect || !energySelect) {
        console.warn("Элементы <select> для формы товара не найдены (productTechnology или productEnergyClass).");
        return;
    }

    // Очищаем предыдущие опции, кроме первой, если она "Выберите..."
    // Сохраняем первую опцию, если она есть и является плейсхолдером
    const firstTechOption = techSelect.options[0] && techSelect.options[0].value === "" ? techSelect.options[0] : null;
    techSelect.innerHTML = '';
    if (firstTechOption) techSelect.appendChild(firstTechOption.cloneNode(true)); else techSelect.innerHTML = '<option value="">-- Выберите технологию --</option>';


    const firstEnergyOption = energySelect.options[0] && energySelect.options[0].value === "" ? energySelect.options[0] : null;
    energySelect.innerHTML = '';
    if (firstEnergyOption) energySelect.appendChild(firstEnergyOption.cloneNode(true)); else energySelect.innerHTML = '<option value="">-- Выберите класс --</option>';


    // Значения ENUM. В идеале, их нужно получать с бэкенда,
    // чтобы они всегда были синхронизированы с определениями в Python Enum.
    // Пока захардкодим их, как в Python моделях.
    const lampTechnologies = {
        "Светодиодная": "Светодиодная",
        "Накаливания": "Накаливания",
        "Галогенная": "Галогенная",
        "Люминесцентная": "Люминесцентная",
        "Другая": "Другая"
    };

    const energyClasses = {
        "A++": "A++",
        "A+": "A+",
        "A": "A",
        "B": "B",
        "C": "C",
        "D": "D",
        "E": "E",
        "F": "F",
        "G": "G"
        // Пустое значение для "не выбрано" уже добавлено выше
    };

    for (const key in lampTechnologies) {
        if (lampTechnologies.hasOwnProperty(key)) {
            const option = document.createElement('option');
            option.value = key; // Значение, которое отправится на сервер
            option.textContent = lampTechnologies[key]; // Текст, который увидит пользователь
            techSelect.appendChild(option);
        }
    }

    for (const key in energyClasses) {
         if (energyClasses.hasOwnProperty(key)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = energyClasses[key];
            energySelect.appendChild(option);
        }
    }
}


// --- Логика для модального окна товара ---
const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');
const productModalTitle = document.getElementById('productModalTitle');
const saveProductButton = document.getElementById('saveProductButton');
const productIdInput = document.getElementById('productId'); // Скрытое поле для ID
const productFormError = document.getElementById('productFormError');

// Открытие модального окна для добавления
document.getElementById('addProductButton')?.addEventListener('click', () => {
    productModalTitle.textContent = 'Добавить новый товар';
    saveProductButton.textContent = 'Добавить товар';
    productIdInput.value = ''; // Очищаем ID
    productForm.reset(); // Сбрасываем форму
    document.getElementById('existingImagesPreview').innerHTML = ''; // Очищаем превью
    productModal.style.display = 'flex';
    populateProductFormSelects(); // Заполняем селекты (технология, класс энергоэффективности)
});

// Глобальная функция для закрытия (используется в HTML)
window.closeProductModal = function() {
    productModal.style.display = 'none';
    productFormError.style.display = 'none';
    productFormError.textContent = '';
};

// Обработка отправки формы товара
productForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    productFormError.style.display = 'none';
    productFormError.textContent = '';

    const formData = new FormData(productForm); // Собираем все данные формы, включая файлы
    const currentProductId = productIdInput.value;
    let endpoint = '/admin/products/';
    let method = 'POST';

    // Pydantic ожидает числовые значения для Decimal и int, FormData передает все как строки.
    // FastAPI (с ProductBase.as_form) должен справиться с преобразованием.
    // Boolean для is_active: если чекбокс не отмечен, он не отправляется.
    // Нужно убедиться, что is_active корректно обрабатывается на бэкенде, если он не пришел.
    // В ProductCreateForm is_active: bool = Form(True) - если не отмечен, будет False или не придет?
    // Если чекбокс не отмечен, он не включается в FormData. На бэкенде is_active: bool = Form(True) будет True.
    // Если нужно передать False, когда не отмечен:
    if (!formData.has('is_active')) {
        formData.set('is_active', 'false'); // FastAPI должен преобразовать 'false' в False
    } else {
        formData.set('is_active', 'true'); // Если отмечен, значение будет 'on', меняем на 'true'
    }


    // Важно: для PUT/PATCH обычно отправляют JSON, а файлы - отдельными запросами.
    // Наш Product Service POST /products/ ожидает multipart/form-data.
    // Для редактирования (PUT) мы будем отправлять JSON с данными товара,
    // а управление изображениями - через отдельные эндпоинты.

    let isFormDataRequest = true; // По умолчанию для создания
    let requestData = formData;

    if (currentProductId) { // Редактирование
        endpoint = `/admin/products/${currentProductId}`;
        method = 'PUT'; // Или PATCH, если хотим частичное обновление
        isFormDataRequest = false; // Для PUT/PATCH шлем JSON

        // Собираем JSON из формы для обновления (кроме файлов)
        const productJsonData = {};
        formData.forEach((value, key) => {
            if (key !== 'images') { // Исключаем поле 'images' из JSON для PUT
                 // Преобразуем строки в числа/булевы, где нужно, если Pydantic на бэкенде не справится
                if (key === 'price' || key === 'power') productJsonData[key] = parseFloat(value);
                else if (key === 'stock_quantity' || key === 'lumens' || key === 'color_temperature') productJsonData[key] = parseInt(value, 10);
                else if (key === 'is_active') productJsonData[key] = (value === 'true' || value === 'on');
                else productJsonData[key] = value;
            }
        });
        requestData = productJsonData;
        console.log("Updating product with JSON:", requestData);
    } else {
        console.log("Creating product with FormData");
        // При создании (POST) FormData уже содержит и поля, и файлы.
        // FastAPI в AdminService (прокси) и ProductService должен это распарсить.
    }


    try {
        await request(endpoint, method, requestData, isFormDataRequest);
        closeProductModal();
        loadProducts(currentProductsPage); // Обновляем список
    } catch (error) {
        console.error('Error saving product:', error);
        productFormError.textContent = error.message || 'Произошла ошибка при сохранении товара.';
        productFormError.style.display = 'block';
    }
});

// --- Вспомогательные функции ---
function escapeHtml(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return unsafe
         .toString()
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, "&quot;");
}

// Заглушки для функций редактирования/удаления (будут реализованы позже)
window.openEditProductModal = async function(productId) {
    console.log(`Editing product ${productId}`);
    productForm.reset();
    document.getElementById('existingImagesPreview').innerHTML = '';
    productFormError.style.display = 'none';
    productFormError.textContent = '';

    try {
        const product = await request(`/admin/products/${productId}`);
        console.log("Product data received for edit:", product);
        productModalTitle.textContent = 'Редактировать товар';
        saveProductButton.textContent = 'Сохранить изменения';
        productIdInput.value = product.product_id;
        populateProductFormSelects();

        // Заполняем форму данными товара
        document.getElementById('productName').value = product.name;
        document.getElementById('productArticle').value = product.article;
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productStock').value = product.stock_quantity;
        document.getElementById('productIsActive').checked = product.is_active;
        document.getElementById('productManufacturer').value = product.manufacturer;
        document.getElementById('productTechnology').value = product.product_technology;
        document.getElementById('productSocket').value = product.socket;
        document.getElementById('productPower').value = product.power;
        document.getElementById('productLumens').value = product.lumens || '';
        document.getElementById('productColorTemp').value = product.color_temperature || '';
        document.getElementById('productVoltage').value = product.voltage || '';
        document.getElementById('productEnergyClass').value = product.class_energy_efficiency || '';

        // Отображение существующих изображений
        const previewContainer = document.getElementById('existingImagesPreview');
        if (product.images && product.images.length > 0) {
            product.images.forEach(img => {
                const imgElementContainer = document.createElement('div');
                imgElementContainer.style.display = 'inline-block';
                imgElementContainer.style.position = 'relative';
                imgElementContainer.style.margin = '5px';

                const imgElement = document.createElement('img');
                const product_service_public_base = 'http://localhost:8001'; // ПОРТ PRODUCT SERVICE!
                imgElement.src = `${product_service_public_base}${img.image_url}`;
                imgElement.alt = product.name;
                imgElement.style.width = '80px';
                imgElement.style.height = '80px';
                imgElement.style.objectFit = 'cover';

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'x';
                deleteBtn.className = 'delete-img-btn'; // Добавить стили
                deleteBtn.type = 'button';
                deleteBtn.style.position = 'absolute';
                deleteBtn.style.top = '0';
                deleteBtn.style.right = '0';
                deleteBtn.onclick = () => deleteProductImage(img.product_image_id, imgElementContainer);

                imgElementContainer.appendChild(imgElement);
                imgElementContainer.appendChild(deleteBtn);
                previewContainer.appendChild(imgElementContainer);
            });
        }


        productModal.style.display = 'flex';
    } catch (error) {
        console.error('Error fetching product for edit:', error);
        alert('Не удалось загрузить данные товара для редактирования.');
    }
};

window.deleteProduct = async function(productId) {
    if (!confirm('Вы уверены, что хотите удалить этот товар?')) {
        return;
    }
    try {
        await request(`/admin/products/${productId}`, 'DELETE');
        loadProducts(currentProductsPage); // Обновляем список
    } catch (error) {
        console.error('Error deleting product:', error);
        alert(error.message || 'Не удалось удалить товар.');
    }
};

async function deleteProductImage(imageId, imageElementContainer) {
    if (!confirm('Вы уверены, что хотите удалить это изображение?')) {
        return;
    }
    try {
        await request(`/admin/products/images/${imageId}`, 'DELETE');
        imageElementContainer.remove(); // Удаляем элемент превью из DOM
        // Возможно, потребуется обновить данные о товаре, если это важно для формы
    } catch (error) {
        console.error('Error deleting product image:', error);
        alert(error.message || 'Не удалось удалить изображение.');
    }
}


populateProductFormSelects();