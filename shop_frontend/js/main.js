function escapeHtml(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return unsafe.toString()
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">");
}


// --- ГЛОБАЛЬНАЯ ФУНКЦИЯ ДЛЯ ИНИЦИАЛИЗАЦИИ ГАЛЕРЕИ ---
// (Может использоваться на product.html)
window.initProductGallery = function(gallerySelector) {
    const gallery = document.querySelector(gallerySelector);
    if (!gallery) return;

    const mainImage = gallery.querySelector('#main-product-image');
    const thumbnailContainer = gallery.querySelector('.product-gallery__thumbnails');
    const prevButton = gallery.querySelector('.product-gallery__arrow--prev');
    const nextButton = gallery.querySelector('.product-gallery__arrow--next');
    
    if (!mainImage || !thumbnailContainer) {
        console.warn("Gallery main image or thumbnails container not found in:", gallerySelector);
        return;
    }
    
    const thumbnails = thumbnailContainer.querySelectorAll('.product-gallery__thumb');
    let currentImageIndex = 0;
    const imageSources = [];

    thumbnails.forEach((thumb) => {
        const imgSrc = thumb.dataset.imageSrc;
        const imgAlt = thumb.dataset.imageAlt;
        if (imgSrc) {
            imageSources.push({ src: imgSrc, alt: imgAlt || 'Изображение товара' });
        }
    });

    if (imageSources.length === 0) {
        if (prevButton) prevButton.style.display = 'none';
        if (nextButton) nextButton.style.display = 'none';
        return;
    }
    
    function setActiveThumbAndImage(index) {
        if (!imageSources[index]) return;

        mainImage.style.opacity = '0';
        setTimeout(() => {
            mainImage.src = imageSources[index].src;
            mainImage.alt = imageSources[index].alt;
            mainImage.style.opacity = '1';
        }, 150);

        thumbnails.forEach((t, thumbIdx) => {
            // Ищем соответствующий индекс в imageSources для текущей миниатюры в DOM
            const currentThumbSourceIndex = imageSources.findIndex(s => s.src === t.dataset.imageSrc);
            t.classList.toggle('active', currentThumbSourceIndex === index);
        });
        currentImageIndex = index;
    }

    // Устанавливаем начальное состояние
    let initialActiveIndex = 0;
    const activeThumbInDOM = thumbnailContainer.querySelector('.product-gallery__thumb.active');
    if (activeThumbInDOM) {
        const idx = imageSources.findIndex(s => s.src === activeThumbInDOM.dataset.imageSrc);
        if (idx !== -1) initialActiveIndex = idx;
    }
    setActiveThumbAndImage(initialActiveIndex);

    thumbnails.forEach((thumb) => {
        thumb.addEventListener('click', () => {
            const clickedThumbSrc = thumb.dataset.imageSrc;
            const newIndex = imageSources.findIndex(s => s.src === clickedThumbSrc);
            if (newIndex !== -1) {
                setActiveThumbAndImage(newIndex);
            }
        });
    });

    if (prevButton) {
        prevButton.style.display = imageSources.length > 1 ? 'flex' : 'none';
        prevButton.addEventListener('click', () => {
            let newIndex = currentImageIndex - 1;
            if (newIndex < 0) newIndex = imageSources.length - 1;
            setActiveThumbAndImage(newIndex);
        });
    }

    if (nextButton) {
        nextButton.style.display = imageSources.length > 1 ? 'flex' : 'none';
        nextButton.addEventListener('click', () => {
            let newIndex = currentImageIndex + 1;
            if (newIndex >= imageSources.length) newIndex = 0;
            setActiveThumbAndImage(newIndex);
        });
    }
};


// --- ОСНОВНАЯ ЛОГИКА, ВЫПОЛНЯЕМАЯ ПОСЛЕ ЗАГРУЗКИ DOM ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Инициализация галереи на странице товара (если есть и если product-page.js ее не вызвал)
    // Обычно product-page.js сам вызовет initProductGallery после создания миниатюр.
    // Этот вызов здесь больше для статических галерей.
    if (document.querySelector('.product-gallery') && typeof window.initProductGallery === 'function' && 
        !document.querySelector('.main-content--product')) { // Не запускать на стр. товара, если product-page.js это сделает
         window.initProductGallery('.product-gallery');
    }

    // --- Логика для страницы Каталога (index.html) ---
    const productGrid = document.querySelector('.product-grid');
    const loadMoreButton = document.querySelector('.load-more-button');
    const sidebarFilterLinks = document.querySelectorAll('.sidebar__filter-link[data-filter-type]');
    const resetFiltersLink = document.getElementById('resetFiltersLink');

    if (productGrid) { // Выполняем только если мы на странице с каталогом
        let catalogCurrentPage = 1;
        const catalogProductsLimit = 9;
        let catalogIsLoading = false;
        let catalogAllProductsLoaded = false;
        let catalogCurrentFilters = {};

        function applyCatalogFiltersAndLoad(newFilters = {}, page = 1) {
            catalogCurrentFilters = { ...catalogCurrentFilters, ...newFilters };
            for (const key in catalogCurrentFilters) {
                if (catalogCurrentFilters[key] === null || catalogCurrentFilters[key] === "") {
                    delete catalogCurrentFilters[key];
                }
            }
            catalogCurrentPage = page; // При новом фильтре начинаем с 1-й страницы
            catalogAllProductsLoaded = false;
            productGrid.innerHTML = ''; // Очищаем перед новым запросом
            if (loadMoreButton) loadMoreButton.style.display = 'block';
            updateBrowserURLForCatalog();
            fetchCatalogProducts(catalogCurrentPage, catalogProductsLimit, catalogCurrentFilters);
        }

        async function fetchCatalogProducts(page = 1, limit = catalogProductsLimit, filters = {}) {
            if (catalogIsLoading || catalogAllProductsLoaded) return;
            catalogIsLoading = true;
            if (loadMoreButton) loadMoreButton.textContent = 'Загрузка...';

            try {
                const queryParams = new URLSearchParams({
                    skip: (page - 1) * limit,
                    limit: limit
                });
                for (const key in filters) {
                    if (filters[key]) {
                        queryParams.set(key, filters[key]);
                    }
                }
                
                const responseData = await apiClientRequest(
                    PRODUCT_SERVICE_API_URL, 
                    `/products?${queryParams.toString()}`
                );

                if (responseData && responseData.items) {
                    renderCatalogProducts(responseData.items);
                    catalogCurrentPage = responseData.page ? responseData.page + 1 : page + 1;
                    
                    if (responseData.items.length < limit || (responseData.page * limit) >= responseData.total_count) {
                        catalogAllProductsLoaded = true;
                        if (loadMoreButton) loadMoreButton.style.display = 'none';
                    } else {
                         if (loadMoreButton) loadMoreButton.style.display = 'block';
                    }
                } else {
                    if (page === 1) productGrid.innerHTML = '<p>Товары не найдены.</p>';
                    catalogAllProductsLoaded = true;
                    if (loadMoreButton) loadMoreButton.style.display = 'none';
                }
            } catch (error) {
                console.error("Failed to fetch catalog products:", error);
                if (page === 1) productGrid.innerHTML = '<p>Не удалось загрузить товары.</p>';
            } finally {
                catalogIsLoading = false;
                if (loadMoreButton && !catalogAllProductsLoaded) loadMoreButton.textContent = 'Загрузить ещё';
            }
        }

        function renderCatalogProducts(products) {
            // Если это не первая страница (т.е. нажали "Загрузить ещё"), не очищаем грид
            // if (catalogCurrentPage === 1) { // Это условие теперь в applyCatalogFiltersAndLoad
            //     productGrid.innerHTML = ''; 
            // }

            products.forEach(product => {
                const articleEl = document.createElement('article');
                articleEl.className = 'product-card';
                articleEl.innerHTML = `
                    <a href="product.html?id=${product.product_id}" class="product-card__link">
                        <div class="product-card__image">
                            <img src="${product.main_image_url || 'https://placehold.co/250x250/e9ecef/adb5bd?text=Image'}" alt="${escapeHtml(product.name)}">
                        </div>
                        <h3 class="product-card__title">${escapeHtml(product.name)}</h3>
                    </a>
                    <div class="product-card__footer">
                         <p class="product-card__price">${parseFloat(product.price).toFixed(2)} ₽</p>
                         <button type="button" class="button product-card__button" 
                            data-product-id="${product.product_id}" 
                            data-product-name="${escapeHtml(product.name)}" 
                            data-product-price="${product.price}" 
                            data-product-image="${product.main_image_url || ''}">В корзину</button>
                    </div>
                `;
                productGrid.appendChild(articleEl);
            });
        }

        sidebarFilterLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const filterType = link.dataset.filterType;
                const filterValue = link.dataset.filterValue;

                sidebarFilterLinks.forEach(l => {
                    if (l.dataset.filterType === filterType) l.classList.remove('active-filter');
                });
                
                if (catalogCurrentFilters[filterType] === filterValue) {
                    applyCatalogFiltersAndLoad({ [filterType]: null });
                } else {
                    link.classList.add('active-filter');
                    applyCatalogFiltersAndLoad({ [filterType]: filterValue });
                }
            });
        });

        if (resetFiltersLink) {
            resetFiltersLink.addEventListener('click', (event) => {
                event.preventDefault();
                catalogCurrentFilters = {};
                sidebarFilterLinks.forEach(l => l.classList.remove('active-filter'));
                applyCatalogFiltersAndLoad();
            });
        }
        
        function updateBrowserURLForCatalog() {
            const queryParams = new URLSearchParams();
            for (const key in catalogCurrentFilters) {
                if (catalogCurrentFilters[key]) {
                    queryParams.set(key, catalogCurrentFilters[key]);
                }
            }
            const newUrl = `${window.location.pathname}${queryParams.toString() ? '?' : ''}${queryParams.toString()}`;
            history.pushState({path: newUrl}, '', newUrl);
        }

        function applyInitialFiltersFromURL() {
            const initialUrlParams = new URLSearchParams(window.location.search);
            const filtersFromUrl = {};
            let hasFiltersAppliedOnLoad = false;
            let GfiltersAppliedOnLoad = false; // Переименовал, чтобы не конфликтовать с глобальной (если есть)
            initialUrlParams.forEach((value, key) => {
                filtersFromUrl[key] = value;
                hasFiltersAppliedOnLoad = true; // Переименовал
                const activeLink = document.querySelector(`.sidebar__filter-link[data-filter-type="${key}"][data-filter-value="${value}"]`);
                if (activeLink) {
                    sidebarFilterLinks.forEach(l => {
                        if(l.dataset.filterType === key) l.classList.remove('active-filter');
                    });
                    activeLink.classList.add('active-filter');
                }
            });

            if (hasFiltersAppliedOnLoad) {
                applyCatalogFiltersAndLoad(filtersFromUrl);
            } else {
                fetchCatalogProducts(catalogCurrentPage);
            }
        }
        
        applyInitialFiltersFromURL();

        if (loadMoreButton) {
            loadMoreButton.addEventListener('click', () => {
                fetchCatalogProducts(catalogCurrentPage, catalogProductsLimit, catalogCurrentFilters);
            });
        }

        // Делегирование для кнопок "В корзину"
        productGrid.addEventListener('click', function(event) {
            if (event.target.classList.contains('product-card__button')) {
                const button = event.target;
                if (typeof addToCart === 'function') { // Проверяем, что addToCart из cart-logic.js доступна
                    addToCart({ 
                        id: button.dataset.productId, 
                        name: button.dataset.productName, 
                        price: parseFloat(button.dataset.productPrice), 
                        image: button.dataset.productImage 
                    });
                    
                    button.textContent = 'Добавлено!';
                    button.disabled = true;
                    setTimeout(() => {
                        button.textContent = 'В корзину';
                        button.disabled = false;
                    }, 1500);
                } else {
                    console.error("addToCart function is not defined!");
                }
            }
        });
    } // Конец if (productGrid)

    // --- Универсальный обработчик для Счетчиков Количества (используется на product.html, cart.html) ---
    document.querySelectorAll('.quantity-selector').forEach(selector => {
        const input = selector.querySelector('.quantity-selector__input');
        const decreaseBtn = selector.querySelector('.quantity-selector__button--decrease');
        const increaseBtn = selector.querySelector('.quantity-selector__button--increase');
        
        if (!input || !decreaseBtn || !increaseBtn) return;

        const min = parseInt(input.min) || 1;
        const max = parseInt(input.max) || 99;

        const updateQuantityValue = (newValue) => {
            input.value = newValue;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        decreaseBtn.addEventListener('click', () => {
            let currentValue = parseInt(input.value);
            if (currentValue > min) updateQuantityValue(currentValue - 1);
        });

        increaseBtn.addEventListener('click', () => {
            let currentValue = parseInt(input.value);
            if (currentValue < max) updateQuantityValue(currentValue + 1);
        });

        input.addEventListener('change', () => {
            let currentValue = parseInt(input.value);
            if (isNaN(currentValue) || currentValue < min) input.value = min; 
            else if (currentValue > max) input.value = max;
            
            // Если это страница корзины, вызываем обновление отображения корзины
            if (document.body.contains(document.querySelector('.cart-section')) && typeof window.updateCartDisplay === 'function') {
                 window.updateCartDisplay();
            }
        });
    });


    // --- Логика для Страницы Корзины (cart.html) ---
    const cartSection = document.querySelector('.cart-section');
    if (cartSection) { // Выполняем только если мы на странице корзины
        const selectAllCheckbox = cartSection.querySelector('#select-all-items');
        const cartItemsListEl = cartSection.querySelector('.cart-items-list');
        const cartTotalPriceEl = cartSection.querySelector('#cart-total-price');
        
        const formatCartPrice = (price) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price);
        
        function renderCartItems() {
            const cartItems = getCartItems(); // из cart-logic.js
            if (!cartItemsListEl) return;
            cartItemsListEl.innerHTML = ''; // Очищаем

            if (cartItems.length === 0) {
                cartItemsListEl.innerHTML = '<li><p>Ваша корзина пуста.</p></li>';
                if (cartTotalPriceEl) cartTotalPriceEl.textContent = formatCartPrice(0);
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = false;
                    selectAllCheckbox.disabled = true;
                }
                // Скрыть кнопку "Оформить заказ" или сделать неактивной
                const checkoutButton = document.querySelector('.cart-summary__checkout-button');
                if(checkoutButton) checkoutButton.style.display = 'none';
                return;
            } else {
                const checkoutButton = document.querySelector('.cart-summary__checkout-button');
                if(checkoutButton) checkoutButton.style.display = 'inline-block'; // Показываем кнопку
            }

            cartItems.forEach(item => {
                const li = document.createElement('li');
                li.className = 'cart-item';
                li.dataset.itemId = item.id;
                li.innerHTML = `
                    <input type="checkbox" class="cart-item__checkbox" aria-label="Выбрать ${escapeHtml(item.name)}" checked data-item-id="${item.id}">
                    <div class="cart-item__image-container" style="width: 60px; height: 60px; margin-right: 10px;"> <!-- Пример контейнера для картинки -->
                        <img src="${item.image || 'https://placehold.co/60x60/e9ecef/adb5bd?text=N/A'}" alt="${escapeHtml(item.name)}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div class="cart-item__details">
                        <span class="cart-item__name">${escapeHtml(item.name)}</span>
                        <span class="cart-item__price-per-unit" data-price-per-unit="${item.price}">${item.price.toFixed(2)} ₽ / шт.</span>
                    </div>
                    <div class="cart-item__quantity quantity-selector">
                        <button type="button" class="quantity-selector__button quantity-selector__button--decrease" aria-label="Уменьшить">-</button>
                        <input type="number" class="quantity-selector__input" value="${item.quantity}" min="1" max="99" aria-label="Количество" data-item-id="${item.id}">
                        <button type="button" class="quantity-selector__button quantity-selector__button--increase" aria-label="Увеличить">+</button>
                    </div>
                    <span class="cart-item__subtotal">${formatCartPrice(item.price * item.quantity)}</span>
                    <button type="button" class="cart-item__remove-button" aria-label="Удалить ${escapeHtml(item.name)}" data-item-id="${item.id}">×</button>
                `;
                cartItemsListEl.appendChild(li);
            });
             if (selectAllCheckbox) selectAllCheckbox.disabled = false;
            updateCartSummaryDisplay();
        }
        
        window.updateCartDisplay = function() { // Делаем глобальной для вызова из quantity selector
            updateCartSummaryDisplay();
        }

        function updateCartSummaryDisplay() {
            let totalCartPrice = 0;
            let allItemsSelectedInDOM = true;
            let atLeastOneItemSelectedInDOM = false;
            const currentItemCheckboxes = cartItemsListEl.querySelectorAll('.cart-item__checkbox');

            if (currentItemCheckboxes.length === 0) {
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = false;
                    selectAllCheckbox.indeterminate = false;
                    selectAllCheckbox.disabled = true;
                }
                if (cartTotalPriceEl) cartTotalPriceEl.textContent = formatCartPrice(0);
                return;
            }
             if (selectAllCheckbox) selectAllCheckbox.disabled = false;


            cartItemsListEl.querySelectorAll('.cart-item').forEach(itemEl => {
                const checkbox = itemEl.querySelector('.cart-item__checkbox');
                const pricePerUnitEl = itemEl.querySelector('.cart-item__price-per-unit');
                const quantityInput = itemEl.querySelector('.quantity-selector__input');
                const subtotalEl = itemEl.querySelector('.cart-item__subtotal');

                if (!checkbox || !pricePerUnitEl || !quantityInput || !subtotalEl) return;

                const pricePerUnit = parseFloat(pricePerUnitEl.dataset.pricePerUnit);
                const quantity = parseInt(quantityInput.value);
                
                const itemSubtotal = pricePerUnit * quantity;
                subtotalEl.textContent = formatCartPrice(itemSubtotal);

                if (checkbox.checked) {
                    totalCartPrice += itemSubtotal;
                    atLeastOneItemSelectedInDOM = true;
                } else {
                    allItemsSelectedInDOM = false;
                }
            });

            if (cartTotalPriceEl) cartTotalPriceEl.textContent = formatCartPrice(totalCartPrice);
            
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = allItemsSelectedInDOM;
                selectAllCheckbox.indeterminate = !allItemsSelectedInDOM && atLeastOneItemSelectedInDOM;
            }
        }

        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', () => {
                cartItemsListEl.querySelectorAll('.cart-item__checkbox').forEach(cb => cb.checked = selectAllCheckbox.checked);
                updateCartSummaryDisplay();
            });
        }

        cartItemsListEl.addEventListener('change', (event) => {
            if (event.target.classList.contains('cart-item__checkbox')) {
                updateCartSummaryDisplay();
            }
            // Если изменили количество через input напрямую (а не кнопками +/-)
            if (event.target.classList.contains('quantity-selector__input')) {
                const itemId = event.target.dataset.itemId;
                const newQuantity = parseInt(event.target.value, 10);
                if (typeof updateCartItemQuantity === 'function') { // из cart-logic.js
                    updateCartItemQuantity(itemId, newQuantity);
                }
                updateCartSummaryDisplay(); // Обновляем отображение после изменения в localStorage
            }
        });
        
        cartItemsListEl.addEventListener('click', (event) => {
            if (event.target.classList.contains('cart-item__remove-button')) {
                const itemId = event.target.dataset.itemId;
                if (typeof removeFromCart === 'function') { // из cart-logic.js
                    removeFromCart(itemId);
                }
                event.target.closest('.cart-item').remove();
                updateCartSummaryDisplay();
            }
            // Обработка кнопок +/- количества (уже покрывается универсальным обработчиком)
        });
        
        renderCartItems(); // Первоначальный рендеринг корзины
    } // Конец if (cartSection)


    // --- Логика для Страницы Подтверждения Заказа (order-confirmation.html) ---
    if (document.querySelector('.confirmation-page-title')) {
        const orderNumberEl = document.getElementById('order-number');
        const deliveryDateEl = document.getElementById('delivery-date');
        const deliveryTimeEl = document.getElementById('delivery-time');

        try {
            const orderNumber = localStorage.getItem('lastOrderNumber');
            const deliveryDate = localStorage.getItem('lastOrderDeliveryDate'); // Пример
            const deliveryTime = localStorage.getItem('lastOrderDeliveryTime'); // Пример

            if (orderNumberEl && orderNumber) orderNumberEl.textContent = escapeHtml(orderNumber); else if (orderNumberEl) orderNumberEl.textContent = "НЕИЗВЕСТЕН";
            if (deliveryDateEl && deliveryDate) deliveryDateEl.textContent = escapeHtml(deliveryDate);
            if (deliveryTimeEl && deliveryTime) deliveryTimeEl.textContent = escapeHtml(deliveryTime);

            // Очищаем данные о последнем заказе из localStorage, чтобы они не показывались снова
            // localStorage.removeItem('lastOrderNumber');
            // localStorage.removeItem('lastOrderDeliveryDate');
            // localStorage.removeItem('lastOrderDeliveryTime');
            // Если заказ успешно создан, корзину тоже нужно очистить:
            // if (typeof clearCart === 'function' && orderNumber) { // из cart-logic.js
            //     clearCart();
            // }
        } catch (e) { console.warn("Error reading order confirmation data from localStorage", e); }
    }

}); // Конец DOMContentLoaded