document.addEventListener('DOMContentLoaded', () => {
    const token = getToken(); // Функция из auth.js
    if (!token) {
        window.location.href = 'login.html'; // Перенаправляем, если нет токена
        return;
    }

    // Элементы навигации
    const navProductsButton = document.getElementById('navProducts');
    const navOrdersButton = document.getElementById('navOrders');
    const productsSection = document.getElementById('productsSection');
    const ordersSection = document.getElementById('ordersSection');
    const logoutButton = document.getElementById('logoutButton');

    // По умолчанию показываем товары
    showSection('products');

    navProductsButton.addEventListener('click', () => showSection('products'));
    navOrdersButton.addEventListener('click', () => showSection('orders'));
    logoutButton.addEventListener('click', () => {
        logout(); // Функция из auth.js
    });

    function showSection(sectionName) {
        // Скрываем все секции
        productsSection.classList.remove('active');
        ordersSection.classList.remove('active');
        // Снимаем active класс с кнопок
        navProductsButton.classList.remove('active');
        navOrdersButton.classList.remove('active');

        if (sectionName === 'products') {
            productsSection.classList.add('active');
            navProductsButton.classList.add('active');
            loadProducts();
        } else if (sectionName === 'orders') {
            ordersSection.classList.add('active');
            navOrdersButton.classList.add('active');
            if (typeof initOrdersSection === 'function') { // Проверяем, что функция загружена
                initOrdersSection(); // <--- ВЫЗОВ ЗДЕСЬ
            } else {
                console.error("initOrdersSection function is not defined!");
                document.getElementById('ordersTableContainer').innerHTML = "<p>Ошибка загрузки модуля заказов.</p>";
            }
        }
    }

    // --- Логика для модальных окон (общая) ---
    // Получаем все модальные окна
    const modals = document.querySelectorAll('.modal');
    // При клике вне модального окна, закрываем его (если нужно)
    // window.onclick = function(event) {
    //     modals.forEach(modal => {
    //         if (event.target == modal) {
    //             modal.style.display = "none";
    //         }
    //     });
    // }
    // Закрытие по кнопке Escape
    document.addEventListener('keydown', function (event) {
        if (event.key === "Escape") {
            modals.forEach(modal => {
                modal.style.display = "none";
            });
        }
    });

    // Функции для открытия/закрытия специфичных модальных окон будут в products.js / orders.js
    // Например:
    // window.openProductModal = function() { document.getElementById('productModal').style.display = 'flex'; }
    // window.closeProductModal = function() { document.getElementById('productModal').style.display = 'none'; }
    // window.openOrderModal = function() { document.getElementById('orderModal').style.display = 'flex'; }
    // window.closeOrderModal = function() { document.getElementById('orderModal').style.display = 'none'; }
    // Сделаем их доступными глобально для onclick атрибутов
});

// Глобальные функции для управления модальными окнами (для onclick)
function closeProductModal() {
    const modal = document.getElementById('productModal');
    if(modal) modal.style.display = 'none';
    // Очистка формы товара при закрытии
    const form = document.getElementById('productForm');
    if(form) form.reset();
    document.getElementById('productId').value = ''; // Сброс ID
    document.getElementById('productModalTitle').textContent = 'Добавить товар';
    document.getElementById('saveProductButton').textContent = 'Добавить товар';
    const errorDiv = document.getElementById('productFormError');
    if(errorDiv) {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
    }
    const previewDiv = document.getElementById('existingImagesPreview');
    if(previewDiv) previewDiv.innerHTML = '';
}

function closeOrderModal() {
    const modal = document.getElementById('orderModal');
    if(modal) modal.style.display = 'none';
    const errorDiv = document.getElementById('orderFormError');
    if(errorDiv) {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
    }
}