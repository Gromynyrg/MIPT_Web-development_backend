document.addEventListener('DOMContentLoaded', async () => {
    const mainContent = document.querySelector('.main-content--product');
    if (!mainContent) return;

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        mainContent.innerHTML = "<p class='container error-message'>ID товара не найден в URL.</p>";
        return;
    }

    // Определяем базовый URL для статики один раз
    let productServiceBaseForStatic;
    if (typeof PRODUCT_SERVICE_API_URL === 'string') {
        productServiceBaseForStatic = PRODUCT_SERVICE_API_URL.replace('/api/v1', '');
    } else {
        console.error("PRODUCT_SERVICE_API_URL not defined for product page! Using fallback.");
        productServiceBaseForStatic = "http://localhost:8001"; // Запасной вариант
    }

    // ... (получение элементов DOM productTitleEl, mainProductImageEl, etc.) ...
    const productTitleEl = document.querySelector('.product-title');
    const breadcrumbCurrentEl = document.querySelector('.breadcrumbs__item[aria-current="page"]');
    const mainProductImageEl = document.getElementById('main-product-image');
    const productThumbnailsContainer = document.querySelector('.product-gallery__thumbnails');
    const productPriceEl = document.querySelector('.product-purchase-block__price');
    const productDescriptionSection = document.querySelector('.product-description');
    const productCharacteristicsList = document.querySelector('.product-characteristics__list');
    const addToCartButton = document.querySelector('.product-purchase-block__button');
    const quantityInput = document.querySelector('.quantity-selector__input');


    try {
        mainContent.classList.add('loading');
        const product = await apiClientRequest(PRODUCT_SERVICE_API_URL, `/products/${productId}`);
        mainContent.classList.remove('loading');

        if (!product || !product.product_id) {
            throw new Error("Товар не найден или API вернул некорректные данные.");
        }

        // ... (заполнение document.title, productTitleEl, breadcrumbCurrentEl, productPriceEl) ...
        document.title = `${escapeHtml(product.name)} - Магазин Лампочек`;
        if (productTitleEl) productTitleEl.textContent = escapeHtml(product.name);
        if (breadcrumbCurrentEl) breadcrumbCurrentEl.textContent = escapeHtml(product.name);
        if (productPriceEl) productPriceEl.textContent = `${parseFloat(product.price).toFixed(2)} ₽`;

        // ... (заполнение описания и характеристик) ...
        if (productDescriptionSection) {
            let descriptionHTML = `<h2 id="product-description-title" class="product-description__title">Описание товара</h2>`;
            descriptionHTML += `<p>${escapeHtml(product.description || "Описание отсутствует.").replace(/\n/g, '<br>')}</p>`;
            productDescriptionSection.innerHTML = descriptionHTML;
        }
        if (productCharacteristicsList) {
            productCharacteristicsList.innerHTML = '';
            addCharacteristic(productCharacteristicsList, "Артикул", product.article);
            // ... (другие характеристики) ...
            addCharacteristic(productCharacteristicsList, "Технология", product.product_technology);
            addCharacteristic(productCharacteristicsList, "Мощность", parseFloat(product.power).toFixed(1) + 'W');
            addCharacteristic(productCharacteristicsList, "Цоколь", product.socket);
            addCharacteristic(productCharacteristicsList, "Производитель", product.manufacturer);
            if(product.lumens) addCharacteristic(productCharacteristicsList, "Световой поток", product.lumens + ' Лм');
            if(product.color_temperature) addCharacteristic(productCharacteristicsList, "Цветовая температура", product.color_temperature + 'K');
            if(product.voltage) addCharacteristic(productCharacteristicsList, "Напряжение", product.voltage);
            if(product.class_energy_efficiency) addCharacteristic(productCharacteristicsList, "Класс энергоэффективности", product.class_energy_efficiency);
        }


        // Галерея изображений
        if (mainProductImageEl && productThumbnailsContainer && product.images && product.images.length > 0) {
            const firstImageUrlFull = `${productServiceBaseForStatic}${product.images[0].image_url}`;
            mainProductImageEl.src = firstImageUrlFull;
            mainProductImageEl.alt = `${escapeHtml(product.name)} - вид 1`;

            productThumbnailsContainer.innerHTML = '';

            product.images.forEach((img, index) => {
                const thumbButton = document.createElement('button');
                thumbButton.className = 'product-gallery__thumb';
                if (index === 0) thumbButton.classList.add('active');
                thumbButton.setAttribute('aria-label', `Показать изображение ${index + 1}`);
                thumbButton.type = 'button';

                const fullImageUrl = `${productServiceBaseForStatic}${img.image_url}`;
                thumbButton.dataset.imageSrc = fullImageUrl; // Сохраняем ПОЛНЫЙ URL
                thumbButton.dataset.imageAlt = `${escapeHtml(product.name)} - вид ${index + 1}`;

                const thumbImg = document.createElement('img');
                thumbImg.src = fullImageUrl; // ПОЛНЫЙ URL для миниатюры
                thumbImg.alt = `Миниатюра: ${escapeHtml(product.name)} - вид ${index + 1}`;

                thumbButton.appendChild(thumbImg);
                productThumbnailsContainer.appendChild(thumbButton);
            });

            if (typeof window.initProductGallery === 'function') {
                window.initProductGallery('.product-gallery');
            } else {
                // ... (упрощенная логика галереи, если initProductGallery нет, она должна использовать data-image-src, который теперь полный URL)
                const thumbs = productThumbnailsContainer.querySelectorAll('.product-gallery__thumb');
                thumbs.forEach(thumb => {
                    thumb.addEventListener('click', () => {
                        if (mainProductImageEl.src !== thumb.dataset.imageSrc) {
                             mainProductImageEl.style.opacity = '0';
                             setTimeout(() => {
                                mainProductImageEl.src = thumb.dataset.imageSrc; // Уже полный URL
                                mainProductImageEl.alt = thumb.dataset.imageAlt;
                                mainProductImageEl.style.opacity = '1';
                             }, 150);
                        }
                        thumbs.forEach(t => t.classList.remove('active'));
                        thumb.classList.add('active');
                    });
                });
            }

        } else if (mainProductImageEl) {
            mainProductImageEl.src = 'https://placehold.co/600x600/e9ecef/adb5bd?text=No+Image';
            mainProductImageEl.alt = escapeHtml(product.name);
            if(productThumbnailsContainer) productThumbnailsContainer.innerHTML = '<p>Нет дополнительных изображений.</p>';
        }

        // Кнопка "Добавить в корзину"
        if (addToCartButton && quantityInput) {
            addToCartButton.onclick = () => {
                const quantity = parseInt(quantityInput.value, 10);
                if (isNaN(quantity) || quantity < 1) {
                    alert("Пожалуйста, выберите корректное количество (минимум 1).");
                    quantityInput.value = 1;
                    return;
                }
                if (typeof addToCart === 'function') {
                    const mainImgForCart = (product.images && product.images.length > 0)
                                        ? `${productServiceBaseForStatic}${product.images[0].image_url}`
                                        : 'https://placehold.co/100x100/e9ecef/adb5bd?text=N/A';
                    addToCart({
                        id: product.product_id,
                        name: product.name,
                        price: parseFloat(product.price),
                        image: mainImgForCart
                    }, quantity);
                    // ... (уведомление)
                    const originalText = addToCartButton.textContent;
                    addToCartButton.textContent = 'Добавлено!';
                    addToCartButton.disabled = true;
                    setTimeout(() => {
                        addToCartButton.textContent = originalText;
                        addToCartButton.disabled = false;
                    }, 2000);
                } else {
                    console.error("addToCart function is not defined!");
                }
            };
        }

    } catch (error) {
        console.error("Failed to load product details on page:", error);
        let userMessage = 'Не удалось загрузить информацию о товаре.';
        if (error.message) {
            userMessage += ` Причина: ${error.message}`;
        }
        if (error.status === 404) {
            userMessage = 'Товар с указанным ID не найден.';
        }
        mainContent.innerHTML = `<p class='container error-message'>${userMessage}</p>`;
    }
});

function addCharacteristic(listElement, label, value) {
    if (value === null || typeof value === 'undefined' || String(value).trim() === "") return;
    const listItem = document.createElement('li');
    listItem.className = 'product-characteristics__item';
    // Используем innerHTML для простоты добавления <strong>, но убедимся, что label и value экранированы
    listItem.innerHTML = `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}`;
    listElement.appendChild(listItem);
}

function escapeHtml(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return unsafe.toString()
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">");
}