// js/checkout.js
document.addEventListener('DOMContentLoaded', () => {
    // Элементы DOM
    const recipientForm = document.getElementById('recipient-form');
    const orderSubtotalEl = document.getElementById('order-subtotal');
    const orderDiscountEl = document.getElementById('order-discount');
    const orderGrandTotalEl = document.getElementById('order-grand-total');
    const promoCodeInput = document.getElementById('promo-code');
    const applyPromoBtn = document.getElementById('apply-promo-btn');
    const promoStatusEl = document.getElementById('promo-status');
    const deliveryMethodRadios = document.querySelectorAll('input[name="deliveryMethod"]');
    const postalAddressGroup = document.getElementById('postal-address-group');
    const addressTextarea = document.getElementById('address');
    const pickupSection = document.getElementById('pickup-section');

    let checkoutItems = []; // Товары, выбранные для оформления
    let currentSubtotal = 0;
    let currentDiscountValue = 0; // Сумма скидки в рублях
    let appliedPromocodeName = null; // Имя примененного промокода

    // Функция форматирования цены
    const formatPrice = (price) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);

    // 1. Загрузка и отображение данных заказа
    function loadCheckoutData() {
        const itemsJson = localStorage.getItem('checkoutItems');
        if (!itemsJson) {
            alert("Нет товаров для оформления. Вы будете перенаправлены в корзину.");
            window.location.href = 'cart.html';
            return;
        }
        try {
            checkoutItems = JSON.parse(itemsJson);
        } catch (e) {
            console.error("Error parsing checkout items:", e);
            alert("Ошибка загрузки товаров для оформления. Пожалуйста, вернитесь в корзину.");
            window.location.href = 'cart.html';
            return;
        }

        if (checkoutItems.length === 0) {
            alert("Нет выбранных товаров для оформления. Вы будете перенаправлены в корзину.");
            window.location.href = 'cart.html';
            return;
        }

        calculateInitialTotals();
        updateOrderSummaryDisplay(); // Обновляем отображение сумм
    }

    function calculateInitialTotals() {
        currentSubtotal = checkoutItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
        // Скидка и промокод будут обработаны отдельно
    }

    function updateOrderSummaryDisplay() {
        if (!orderSubtotalEl || !orderDiscountEl || !orderGrandTotalEl) return;

        orderSubtotalEl.textContent = formatPrice(currentSubtotal);
        orderDiscountEl.textContent = formatPrice(currentDiscountValue * -1); // Показываем скидку как отрицательное число
        
        const grandTotal = currentSubtotal - currentDiscountValue;
        orderGrandTotalEl.textContent = formatPrice(grandTotal > 0 ? grandTotal : 0);
    }

    // 2. Логика промокода
    if (applyPromoBtn && promoCodeInput && promoStatusEl) {
        applyPromoBtn.addEventListener('click', async () => {
            const promoCodeName = promoCodeInput.value.trim().toUpperCase();
            promoStatusEl.textContent = '';
            promoStatusEl.className = 'promo-status-message'; // Сброс классов
            currentDiscountValue = 0; // Сбрасываем текущую скидку перед новой попыткой
            appliedPromocodeName = null;

            if (!promoCodeName) {
                promoStatusEl.textContent = 'Пожалуйста, введите промокод.';
                promoStatusEl.classList.add('error');
                updateOrderSummaryDisplay();
                return;
            }

            try {
                // Запрос к Order Service для проверки промокода
                // Используем apiClientRequest из api_client.js
                // PRODUCT_SERVICE_API_URL и ORDER_SERVICE_API_URL должны быть доступны из config_client.js
                const promoData = await apiClientRequest(ORDER_SERVICE_API_URL, `/promocodes/name/${encodeURIComponent(promoCodeName)}`);
                
                if (promoData && promoData.is_active) {
                    // Проверяем min_order_cost (если есть)
                    if (promoData.min_order_cost && currentSubtotal < parseFloat(promoData.min_order_cost)) {
                        promoStatusEl.textContent = `Промокод действителен, но минимальная сумма заказа (${formatPrice(promoData.min_order_cost)}) не достигнута.`;
                        promoStatusEl.classList.add('warning'); // Или error
                    } else {
                        if (promoData.percent) {
                            currentDiscountValue = (currentSubtotal * promoData.percent) / 100;
                        } else if (promoData.value) {
                            currentDiscountValue = parseFloat(promoData.value);
                        }
                        currentDiscountValue = Math.min(currentDiscountValue, currentSubtotal); // Скидка не может быть больше суммы
                        appliedPromocodeName = promoData.promocode_name;
                        promoStatusEl.textContent = 'Промокод применен!';
                        promoStatusEl.classList.add('success');
                    }
                } else {
                    promoStatusEl.textContent = 'Промокод не найден или неактивен.';
                    promoStatusEl.classList.add('error');
                }
            } catch (error) {
                console.error("Error applying promocode:", error);
                promoStatusEl.textContent = error.data?.detail || error.message || 'Ошибка при проверке промокода.';
                promoStatusEl.classList.add('error');
            }
            updateOrderSummaryDisplay();
        });
    }

    // 3. Управление отображением полей в зависимости от способа доставки (код из твоего checkout.js)
    function toggleDeliveryFields() {
        // ... (код этой функции, как ты его предоставлял, он должен работать) ...
        // Убедись, что postalAddressGroup, addressTextarea, pickupSection корректно определены
        if (!postalAddressGroup || !addressTextarea || !pickupSection) {
            console.warn("Элементы для управления доставкой не найдены на странице.");
            return;
        }
        const selectedMethodRadio = document.querySelector('input[name="deliveryMethod"]:checked');
        if (!selectedMethodRadio) {
            postalAddressGroup.classList.add('hidden-field');
            addressTextarea.required = false;
            pickupSection.classList.remove('hidden-field');
            return;
        }
        const selectedMethod = selectedMethodRadio.value;
        if (selectedMethod === 'pickup') {
            postalAddressGroup.classList.add('hidden-field');
            addressTextarea.required = false;
            pickupSection.classList.remove('hidden-field');
        } else { // 'post'
            postalAddressGroup.classList.remove('hidden-field');
            addressTextarea.required = true;
            pickupSection.classList.add('hidden-field');
        }
    }
    if (deliveryMethodRadios.length > 0) {
        deliveryMethodRadios.forEach(radio => radio.addEventListener('change', toggleDeliveryFields));
        toggleDeliveryFields(); 
    }

    // 4. Обработка отправки формы заказа
    if (recipientForm) {
        recipientForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            toggleDeliveryFields(); // Убедимся, что required у поля адреса актуально
            if (!this.checkValidity()) {
                alert('Пожалуйста, заполните все обязательные поля корректно.');
                let firstInvalidField = this.querySelector(':invalid');
                if(firstInvalidField) firstInvalidField.focus();
                return;
            }

            const formData = new FormData(this);
            const customerData = {
                customer_surname: formData.get('surname'),
                customer_first_name: formData.get('name'),
                customer_email: formData.get('email'), // Убедись, что поле email есть в форме! Его не было в HTML.
                customer_phone_number: formData.get('phone'),
                // delivery_method: formData.get('deliveryMethod'), // Это поле не нужно для Order Service
                // address: formData.get('deliveryMethod') === 'post' ? formData.get('address') : null // Адрес тоже не часть OrderCreate
            };

            // Формируем items для OrderCreate
            const orderItemsForApi = checkoutItems.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                name: item.name, // Имя на момент заказа
                price_per_one: item.price // Цена на момент заказа
            }));

            const orderPayload = {
                ...customerData,
                promocode_name_applied: appliedPromocodeName, // Имя примененного промокода
                items: orderItemsForApi
            };

            console.log('Отправка заказа на бэкенд:', orderPayload);
            
            try {
                const createdOrder = await apiClientRequest(ORDER_SERVICE_API_URL, '/orders', 'POST', orderPayload);
                console.log('Заказ успешно создан:', createdOrder);

                if (createdOrder && createdOrder.number) {
                    // Сохраняем данные для страницы подтверждения
                    localStorage.setItem('lastOrderNumber', createdOrder.number);
                    localStorage.setItem('lastOrderTotal', createdOrder.total_cost_with_promo);
                    localStorage.setItem('lastOrderDeliveryMethod', formData.get('deliveryMethod'));
                    if (formData.get('deliveryMethod') === 'post') {
                        localStorage.setItem('lastOrderAddress', formData.get('address'));
                    }
                    // Можно добавить расчетную дату доставки, если API ее вернет или посчитать на клиенте
                    const deliveryDate = new Date();
                    deliveryDate.setDate(deliveryDate.getDate() + 3); // Пример: доставка через 3 дня
                    localStorage.setItem('lastOrderDeliveryDate', deliveryDate.toLocaleDateString('ru-RU'));
                    localStorage.setItem('lastOrderDeliveryTime', '18:00'); // Пример

                    clearCart(); // Очищаем корзину из cart-logic.js
                    localStorage.removeItem('checkoutItems'); // Очищаем товары для оформления

                    window.location.href = 'order-confirmation.html';
                } else {
                    alert('Не удалось создать заказ. Не получен номер заказа от сервера.');
                }
            } catch (error) {
                console.error('Ошибка при создании заказа:', error);
                alert(`Не удалось создать заказ: ${error.message || 'Произошла серверная ошибка.'}`);
            }
        });
    }

    // Инициализация данных при загрузке страницы
    loadCheckoutData();
});
