// admin_frontend/js/orders.js

// Глобальные переменные для пагинации заказов
let currentOrdersPage = 1;
const ordersPerPage = 10; // Сколько заказов на странице
let totalOrderPages = 1;

// Элементы DOM
const ordersTableContainer = document.getElementById('ordersTableContainer');
const ordersPaginationContainer = document.getElementById('ordersPaginationContainer');
const orderSearchInput = document.getElementById('orderSearch');
const orderStatusFilterSelect = document.getElementById('orderStatusFilter');

const orderModal = document.getElementById('orderModal');
const orderModalTitle = document.getElementById('orderModalTitle');
const orderDetailsContent = document.getElementById('orderDetailsContent');
const orderStatusSelectModal = document.getElementById('orderStatusSelect'); // Селект статуса в модалке
const saveOrderStatusButton = document.getElementById('saveOrderStatusButton');
const orderFormError = document.getElementById('orderFormError');
let currentEditingOrderId = null; // Для хранения ID редактируемого заказа

// Возможные статусы заказа (в идеале, получать с бэкенда)
const ORDER_STATUSES = {
    "NEW": "Новый",
    "PROCESSING": "В обработке",
    "AWAITING_PAYMENT": "Ожидает оплаты", // Если используется
    "PAYMENT_FAILED": "Ошибка оплаты",  // Если используется
    "SHIPPED": "Отправлен",
    "DELIVERED": "Доставлен",
    "COMPLETED": "Выполнен",
    "CANCELLED": "Отменён",
    "REFUNDED": "Возвращен",    // Если используется
    "ON_HOLD": "На удержании" // Если используется
};

// Инициализация раздела "Заказы" (вызывается из main_admin.js при переключении вкладок)
async function initOrdersSection() {
    console.log("Initializing Orders Section");
    if (!ordersTableContainer || !ordersPaginationContainer || !orderSearchInput || !orderStatusFilterSelect) {
        console.error("One or more critical elements for Orders section are missing!");
        if(ordersTableContainer) ordersTableContainer.innerHTML = "<p>Ошибка инициализации раздела заказов.</p>";
        return;
    }
    populateOrderStatusFilter();
    await loadOrders(); // Загружаем первую страницу по умолчанию

    // Обработчики событий для фильтров
    let searchOrderTimeout;
    orderSearchInput.addEventListener('input', (event) => {
        clearTimeout(searchOrderTimeout);
        const searchTerm = event.target.value;
        searchOrderTimeout = setTimeout(() => {
            loadOrders(1, ordersPerPage, orderStatusFilterSelect.value, searchTerm);
        }, 500);
    });

    orderStatusFilterSelect.addEventListener('change', (event) => {
        loadOrders(1, ordersPerPage, event.target.value, orderSearchInput.value);
    });

    saveOrderStatusButton?.addEventListener('click', handleSaveOrderStatus);
}

// Заполнение фильтра статусов
function populateOrderStatusFilter() {
    if (!orderStatusFilterSelect) return;
    orderStatusFilterSelect.innerHTML = '<option value="">Все статусы</option>'; // Опция по умолчанию
    for (const key in ORDER_STATUSES) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = ORDER_STATUSES[key];
        orderStatusFilterSelect.appendChild(option);
    }
}

// Заполнение селекта статуса в модальном окне
function populateOrderStatusModalSelect(currentStatus = "") {
    if (!orderStatusSelectModal) return;
    orderStatusSelectModal.innerHTML = ''; // Очищаем
    for (const key in ORDER_STATUSES) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = ORDER_STATUSES[key];
        if (key === currentStatus) {
            option.selected = true;
        }
        orderStatusSelectModal.appendChild(option);
    }
}

// Загрузка и отображение заказов
async function loadOrders(page = 1, limit = ordersPerPage, statusFilter = '', searchTerm = '') {
    ordersTableContainer.innerHTML = "<p>Загрузка заказов...</p>";
    ordersPaginationContainer.innerHTML = '';

    try {
        let endpoint = `/admin/orders?skip=${(page - 1) * limit}&limit=${limit}`;
        if (statusFilter) {
            endpoint += `&status=${encodeURIComponent(statusFilter)}`;
        }
        if (searchTerm && searchTerm.trim() !== "") {
            endpoint += `&search=${encodeURIComponent(searchTerm.trim())}`;
        }

        const responseData = await request(endpoint); // Функция из api.js

        if (responseData && responseData.items && typeof responseData.total_count !== 'undefined') {
            renderOrdersTable(responseData.items, ordersTableContainer);
            totalOrderPages = responseData.pages || Math.ceil(responseData.total_count / limit);
            currentOrdersPage = responseData.page || page;
            renderOrdersPagination(ordersPaginationContainer);
        } else {
            ordersTableContainer.innerHTML = "<p>Заказы не найдены или ошибка в данных.</p>";
            console.warn("Received unexpected data structure from /admin/orders/", responseData);
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        ordersTableContainer.innerHTML = "<p>Не удалось загрузить заказы. Попробуйте позже.</p>";
        // Дополнительная обработка ошибок, если нужно
    }
}

// Рендеринг таблицы заказов
function renderOrdersTable(orders, container) {
    if (orders.length === 0) {
        container.innerHTML = "<p>Заказы не найдены.</p>";
        return;
    }

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>№</th>
                    <th>Номер заказа</th>
                    <th>Дата</th>
                    <th>Клиент</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;
    const startNumber = (currentOrdersPage - 1) * ordersPerPage + 1;

    orders.forEach((order, index) => {
        const orderDate = new Date(order.created_at).toLocaleDateString('ru-RU');
        const clientName = `${escapeHtml(order.customer_first_name)} ${escapeHtml(order.customer_surname)}`;
        const statusText = ORDER_STATUSES[order.status] || order.status;

        tableHTML += `
            <tr onclick="openOrderDetailsModal('${order.order_id}')" style="cursor:pointer;">
                <td>${startNumber + index}</td>
                <td>${escapeHtml(order.number)}</td>
                <td>${orderDate}</td>
                <td>${clientName}</td>
                <td>${order.total_cost_with_promo} ₽</td>
                <td>${escapeHtml(statusText)}</td>
                <td>
                    <button class="btn-table-action view" onclick="event.stopPropagation(); openOrderDetailsModal('${order.order_id}')">Просмотр</button>
                </td>
            </tr>
        `;
    });

    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

// Рендеринг пагинации для заказов
function renderOrdersPagination(container) {
    if (totalOrderPages <= 1) {
        container.innerHTML = '';
        return;
    }
    let paginationHTML = '';
    paginationHTML += `<button onclick="loadOrders(${currentOrdersPage - 1}, ordersPerPage, orderStatusFilterSelect.value, orderSearchInput.value)" ${currentOrdersPage === 1 ? 'disabled' : ''}><</button>`;

    // Упрощенная пагинация: всегда показываем несколько страниц вокруг текущей
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentOrdersPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalOrderPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow && startPage > 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (startPage > 1) {
        paginationHTML += `<button onclick="loadOrders(1, ordersPerPage, orderStatusFilterSelect.value, orderSearchInput.value)">1</button>`;
        if (startPage > 2) paginationHTML += `<span>...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentOrdersPage) {
            paginationHTML += `<span class="current-page">${i}</span>`;
        } else {
            paginationHTML += `<button onclick="loadOrders(${i}, ordersPerPage, orderStatusFilterSelect.value, orderSearchInput.value)">${i}</button>`;
        }
    }

    if (endPage < totalOrderPages) {
        if (endPage < totalOrderPages - 1) paginationHTML += `<span>...</span>`;
        paginationHTML += `<button onclick="loadOrders(${totalOrderPages}, ordersPerPage, orderStatusFilterSelect.value, orderSearchInput.value)">${totalOrderPages}</button>`;
    }

    paginationHTML += `<button onclick="loadOrders(${currentOrdersPage + 1}, ordersPerPage, orderStatusFilterSelect.value, orderSearchInput.value)" ${currentOrdersPage === totalOrderPages ? 'disabled' : ''}>></button>`;
    container.innerHTML = paginationHTML;
}


// --- Логика для модального окна детализации заказа ---

// Глобальная функция для открытия (вызывается из HTML)
window.openOrderDetailsModal = async function(orderId) {
    if (!orderModal || !orderDetailsContent || !orderModalTitle || !orderStatusSelectModal || !orderFormError) {
        console.error("Order modal elements not found!");
        return;
    }
    orderDetailsContent.innerHTML = "<p>Загрузка деталей заказа...</p>";
    orderFormError.textContent = '';
    orderFormError.style.display = 'none';
    orderModal.style.display = 'flex';
    currentEditingOrderId = orderId; // Сохраняем ID текущего заказа

    try {
        const order = await request(`/admin/orders/${orderId}`); // Функция из api.js
        console.log("Order details:", order);

        orderModalTitle.textContent = `Заказ №${escapeHtml(order.number)} от ${new Date(order.created_at).toLocaleDateString('ru-RU')}`;

        let detailsHTML = `
            <h4>Получатель:</h4>
            <p>
                ${escapeHtml(order.customer_first_name)} ${escapeHtml(order.customer_surname)}<br>
                Email: ${escapeHtml(order.customer_email)}<br>
                Телефон: ${escapeHtml(order.customer_phone_number)}
            </p>
            <h4>Состав заказа:</h4>
            <table>
                <thead>
                    <tr><th>№</th><th>Артикул (ID товара)</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Стоимость</th></tr>
                </thead>
                <tbody>
        `;
        let itemNumber = 1;
        order.items.forEach(item => {
            detailsHTML += `
                <tr>
                    <td>${itemNumber++}</td>
                    <td>${escapeHtml(item.product_id.substring(0,8))}...</td> <!-- Показываем часть ID товара -->
                    <td>${escapeHtml(item.name)}</td>
                    <td>${item.quantity}</td>
                    <td>${item.price_per_one} ₽</td>
                    <td>${(item.quantity * item.price_per_one).toFixed(2)} ₽</td>
                </tr>
            `;
        });
        detailsHTML += `
                </tbody>
                <tfoot>
                    <tr><td colspan="5" style="text-align:right;"><strong>Итого позиций:</strong></td><td><strong>${order.total_cost} ₽</strong></td></tr>
                </tfoot>
            </table>
        `;

        if (order.promocode_applied_details) { // Используем переименованное поле или то, что приходит
            detailsHTML += `
                <h4>Применен промокод:</h4>
                <p>
                    Код: ${escapeHtml(order.promocode_applied_details.promocode_name)} <br>
                    Скидка:
                    ${order.promocode_applied_details.percent ? order.promocode_applied_details.percent + '%' : ''}
                    ${order.promocode_applied_details.value ? order.promocode_applied_details.value + '₽' : ''}
                </p>
            `;
        }
         detailsHTML += `<p><strong>Итоговая стоимость с учётом промокодов: ${order.total_cost_with_promo} ₽</strong></p>`;


        orderDetailsContent.innerHTML = detailsHTML;
        populateOrderStatusModalSelect(order.status); // Заполняем и выбираем текущий статус

    } catch (error) {
        console.error(`Error loading order details for ${orderId}:`, error);
        orderDetailsContent.innerHTML = `<p class="error-message">Не удалось загрузить детали заказа. ${error.message || ''}</p>`;
        orderStatusSelectModal.innerHTML = ''; // Очищаем селект статусов
    }
};

// Глобальная функция для закрытия (используется в HTML)
window.closeOrderModal = function() {
    if(orderModal) orderModal.style.display = 'none';
    currentEditingOrderId = null;
    if(orderFormError) {
        orderFormError.textContent = '';
        orderFormError.style.display = 'none';
    }
};

// Обработчик сохранения нового статуса заказа
async function handleSaveOrderStatus() {
    if (!currentEditingOrderId || !orderStatusSelectModal.value) {
        showOrderModalError("Не выбран заказ или статус.");
        return;
    }
    orderFormError.textContent = '';
    orderFormError.style.display = 'none';

    const newStatus = orderStatusSelectModal.value;
    console.log(`Saving new status for order ${currentEditingOrderId}: ${newStatus}`);

    try {
        await request(`/admin/orders/${currentEditingOrderId}/status`, 'PATCH', { status: newStatus });
        closeOrderModal();
        loadOrders(currentOrdersPage, ordersPerPage, orderStatusFilterSelect.value, orderSearchInput.value); // Обновляем список
    } catch (error) {
        console.error('Error saving order status:', error);
        showOrderModalError(error.message || "Не удалось сохранить статус заказа.");
    }
}

function showOrderModalError(message) {
    if(orderFormError) {
        orderFormError.textContent = message;
        orderFormError.style.display = 'block';
    }
}

// Для escapeHtml, если он еще не глобальный
function escapeHtml(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return unsafe.toString().replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}