document.addEventListener('DOMContentLoaded', () => {
    const cartSection = document.querySelector('.cart-section');
    if (!cartSection) return; // Выполняем только если мы на странице корзины

    const selectAllCheckbox = cartSection.querySelector('#select-all-items');
    const cartItemsListEl = cartSection.querySelector('.cart-items-list');
    const cartTotalPriceEl = cartSection.querySelector('#cart-total-price');
    const checkoutButton = cartSection.querySelector('.cart-summary__checkout-button');

    const formatPrice = (price) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price);

    function renderCartPage() {
        const cartItems = getCartItems(); // из cart-logic.js
        if (!cartItemsListEl || !cartTotalPriceEl || !selectAllCheckbox || !checkoutButton) {
            console.error("One or more cart page elements are missing!");
            return;
        }
        cartItemsListEl.innerHTML = ''; // Очищаем

        if (cartItems.length === 0) {
            cartItemsListEl.innerHTML = '<li><p style="text-align:center; padding: 20px 0;">Ваша корзина пуста.</p></li>';
            cartTotalPriceEl.textContent = formatPrice(0);
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
            selectAllCheckbox.disabled = true;
            checkoutButton.classList.add('disabled'); // Сделать кнопку неактивной (добавить стили)
            checkoutButton.setAttribute('aria-disabled', 'true');
            checkoutButton.tabIndex = -1; // Убрать из порядка табуляции
            return;
        }

        selectAllCheckbox.disabled = false;
        checkoutButton.classList.remove('disabled');
        checkoutButton.removeAttribute('aria-disabled');
        checkoutButton.tabIndex = 0;

        cartItems.forEach(item => {
            const li = document.createElement('li');
            li.className = 'cart-item';
            li.dataset.itemId = item.id;
            const itemIsSelected = typeof item.selected === 'boolean' ? item.selected : true; // По умолчанию выбран, если нет поля

            li.innerHTML = `
                <input type="checkbox" class="cart-item__checkbox" aria-label="Выбрать ${escapeHtml(item.name)}" ${itemIsSelected ? 'checked' : ''} data-item-id="${item.id}">
                <div class="cart-item__image-container" style="width: 60px; height: 60px; margin-right: 10px;">
                    <img src="${escapeHtml(item.image || 'https://placehold.co/60x60/e9ecef/adb5bd?text=N/A')}" alt="${escapeHtml(item.name)}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div class="cart-item__details">
                    <span class="cart-item__name">${escapeHtml(item.name)}</span>
                    <span class="cart-item__price-per-unit" data-price-per-unit="${item.price}">${parseFloat(item.price).toFixed(2)} ₽ / шт.</span>
                </div>
                <div class="cart-item__quantity quantity-selector">
                    <button type="button" class="quantity-selector__button quantity-selector__button--decrease" aria-label="Уменьшить">-</button>
                    <input type="number" class="quantity-selector__input" value="${item.quantity}" min="1" max="99" aria-label="Количество" data-item-id="${item.id}">
                    <button type="button" class="quantity-selector__button quantity-selector__button--increase" aria-label="Увеличить">+</button>
                </div>
                <span class="cart-item__subtotal">${formatPrice(item.price * item.quantity)}</span>
                <button type="button" class="cart-item__remove-button" aria-label="Удалить ${escapeHtml(item.name)}" data-item-id="${item.id}">×</button>
            `;
            cartItemsListEl.appendChild(li);

            // Навешиваем обработчики на созданные элементы (или используем делегирование ниже)
            const quantityInput = li.querySelector('.quantity-selector__input');
            const decreaseBtn = li.querySelector('.quantity-selector__button--decrease');
            const increaseBtn = li.querySelector('.quantity-selector__button--increase');
            const removeBtn = li.querySelector('.cart-item__remove-button');
            const checkbox = li.querySelector('.cart-item__checkbox');

            // Изменение количества через input
            quantityInput.addEventListener('change', (e) => {
                let newQuantity = parseInt(e.target.value, 10);
                const min = parseInt(e.target.min, 10) || 1;
                const max = parseInt(e.target.max, 10) || 99;
                if (isNaN(newQuantity) || newQuantity < min) newQuantity = min;
                if (newQuantity > max) newQuantity = max;
                e.target.value = newQuantity; // Устанавливаем скорректированное значение
                updateCartItemQuantity(item.id, newQuantity); // Обновляем в localStorage
                renderCartPage(); // Перерисовываем всю корзину (просто, но можно оптимизировать)
            });
            // Кнопки +/-
            decreaseBtn.addEventListener('click', () => {
                if (item.quantity > 1) {
                    updateCartItemQuantity(item.id, item.quantity - 1);
                    renderCartPage();
                } else { // Если количество 1 и нажимаем минус, удаляем товар
                    removeFromCart(item.id);
                    renderCartPage();
                }
            });
            increaseBtn.addEventListener('click', () => {
                updateCartItemQuantity(item.id, item.quantity + 1);
                renderCartPage();
            });
            // Удаление
            removeBtn.addEventListener('click', () => {
                if (confirm(`Удалить "${escapeHtml(item.name)}" из корзины?`)) {
                    removeFromCart(item.id);
                    renderCartPage();
                }
            });
            // Чекбокс
            checkbox.addEventListener('change', (e) => {
                toggleItemSelected(item.id, e.target.checked);
                updateSummaryAndSelectAllState();
            });
        });
        updateSummaryAndSelectAllState();
    }

    function updateSummaryAndSelectAllState() {
        const cartItems = getCartItems();
        let totalSelectedPrice = 0;
        let allCurrentlySelected = true;
        let atLeastOneSelected = false;

        if (cartItems.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
            selectAllCheckbox.disabled = true;
            if (cartTotalPriceEl) cartTotalPriceEl.textContent = formatPrice(0);
            checkoutButton.classList.add('disabled');
            checkoutButton.setAttribute('aria-disabled', 'true');
            checkoutButton.tabIndex = -1;
            return;
        }

        selectAllCheckbox.disabled = false;

        cartItems.forEach(item => {
            if (item.selected) {
                totalSelectedPrice += item.price * item.quantity;
                atLeastOneSelected = true;
            } else {
                allCurrentlySelected = false;
            }
        });

        if (cartTotalPriceEl) cartTotalPriceEl.textContent = formatPrice(totalSelectedPrice);
        selectAllCheckbox.checked = allCurrentlySelected;
        selectAllCheckbox.indeterminate = !allCurrentlySelected && atLeastOneSelected;

        if (atLeastOneSelected) {
            checkoutButton.classList.remove('disabled');
            checkoutButton.removeAttribute('aria-disabled');
            checkoutButton.tabIndex = 0;
        } else {
            checkoutButton.classList.add('disabled');
            checkoutButton.setAttribute('aria-disabled', 'true');
            checkoutButton.tabIndex = -1;
        }
    }

    selectAllCheckbox.addEventListener('change', () => {
        toggleSelectAllItems(selectAllCheckbox.checked); // Обновляем localStorage
        // Обновляем DOM чекбоксы (так как localStorage мог не успеть обновиться для renderCartPage)
        cartItemsListEl.querySelectorAll('.cart-item__checkbox').forEach(cb => cb.checked = selectAllCheckbox.checked);
        updateSummaryAndSelectAllState();
    });

    checkoutButton.addEventListener('click', (e) => {
        if (checkoutButton.classList.contains('disabled')) {
            e.preventDefault();
            alert("Пожалуйста, выберите хотя бы один товар для оформления заказа.");
            return;
        }
        const cartItems = getCartItems();
        const selectedItems = cartItems.filter(item => item.selected);
        if (selectedItems.length === 0) {
            e.preventDefault();
            alert("Пожалуйста, выберите хотя бы один товар для оформления заказа.");
            return;
        }
        // Сохраняем выбранные товары для страницы checkout
        try {
            localStorage.setItem('checkoutItems', JSON.stringify(selectedItems));
        } catch (err) {
            console.error("Error saving checkout items to localStorage:", err);
            alert("Не удалось подготовить данные для оформления заказа.");
            e.preventDefault();
        }
        // Переход на checkout.html происходит по href в HTML, если не предотвратить
    });

    // Первоначальный рендеринг корзины при загрузке страницы
    renderCartPage();

    // Универсальные обработчики количества из main.js могут конфликтовать или дублироваться.
    // Лучше, если логика изменения количества для корзины будет только здесь.
    // Убери или адаптируй вызов window.updateCartDisplay() из универсального обработчика счетчика,
    // если он вызывается на странице корзины, так как renderCartPage() делает то же самое.
});

// Убери вызов window.updateCartDisplay из глобального обработчика счетчиков в main.js,
// когда мы на странице корзины, чтобы избежать двойного обновления.
// В main.js, в обработчике input.addEventListener('change', ...) для quantity-selector:
// Замени:
// if (document.querySelector('.cart-section')) { ... window.updateCartDisplay(); ... }
// На:
// if (document.body.contains(document.querySelector('.cart-section')) && typeof window.updateCartDisplay === 'function') {
//    // renderCartPage() уже вызывается из обработчиков в cart-page.js,
//    // здесь дополнительный вызов updateCartDisplay может быть не нужен или вызывать конфликт.
//    // Либо убедись, что updateCartDisplay не вызывает renderCartPage, а только пересчитывает суммы.
//    // Наша текущая updateCartDisplay перерисовывает, так что лучше не вызывать.
// }

// Вспомогательная функция escapeHtml (если она не глобальная из другого файла)
function escapeHtml(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return unsafe.toString().replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}