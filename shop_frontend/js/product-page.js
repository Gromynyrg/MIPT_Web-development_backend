document.addEventListener('DOMContentLoaded', async () => {
    const mainContent = document.querySelector('.main-content--product');
    if (!mainContent) {
        console.log("Not a product page, exiting product-page.js script.");
        return; // Выходим, если это не страница товара
    }

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        mainContent.innerHTML = "<p class='container error-message'>ID товара не найден в URL. Пожалуйста, вернитесь в каталог и выберите товар.</p>";
        return;
    }

    // Элементы для заполнения (получаем их один раз)
    const productTitleEl = document.querySelector('.product-title');
    const breadcrumbCurrentEl = document.querySelector('.breadcrumbs__item[aria-current="page"]');
    const mainProductImageEl = document.getElementById('main-product-image');
    const productThumbnailsContainer = document.querySelector('.product-gallery__thumbnails');
    const productPriceEl = document.querySelector('.product-purchase-block__price');
    const productDescriptionSection = document.querySelector('.product-description');
    const productCharacteristicsList = document.querySelector('.product-characteristics__list');
    const addToCartButton = document.querySelector('.product-purchase-block__button');
    const quantityInput = document.querySelector('.quantity-selector__input'); // Счетчик количества

    // Проверка наличия всех ключевых элементов, прежде чем делать запрос
    if (!productTitleEl || !breadcrumbCurrentEl || !mainProductImageEl || !productThumbnailsContainer ||
        !productPriceEl || !productDescriptionSection || !productCharacteristicsList || !addToCartButton || !quantityInput) {
        console.error("One or more essential page elements for product display are missing.");
        mainContent.innerHTML = "<p class='container error-message'>Ошибка структуры страницы товара. Некоторые элементы не найдены.</p>";
        return;
    }

    // --- Загрузка данных о товаре ---
    try {
        mainContent.classList.add('loading'); // Для индикатора загрузки (стили нужно добавить)
        console.log(`Fetching product with ID: ${productId}`);
        const product = await apiClientRequest(PRODUCT_SERVICE_API_URL, `/products/${productId}`);
        mainContent.classList.remove('loading');

        if (!product || !product.product_id) {
            throw new Error("Товар не найден или API вернул некорректные данные.");
        }
        console.log("Product data received:", product);

        // 1. Заполняем страницу данными
        document.title = `${escapeHtml(product.name)} - Магазин Лампочек`;
        productTitleEl.textContent = escapeHtml(product.name);
        breadcrumbCurrentEl.textContent = escapeHtml(product.name);
        productPriceEl.textContent = `${parseFloat(product.price).toFixed(2)} ₽`;

        // 2. Описание
        let descriptionHTML = `<h2 id="product-description-title" class="product-description__title">Описание товара</h2>`;
        descriptionHTML += `<p>${escapeHtml(product.description || "Описание для этого товара пока отсутствует.").replace(/\n/g, '<br>')}</p>`;
        // Можно добавить циклы для генерации "Преимущества", "Применение", если они приходят как массивы/объекты
        productDescriptionSection.innerHTML = descriptionHTML;

        // 3. Характеристики
        productCharacteristicsList.innerHTML = ''; // Очищаем
        addCharacteristic(productCharacteristicsList, "Артикул", product.article);
        addCharacteristic(productCharacteristicsList, "Производитель", product.manufacturer);
        addCharacteristic(productCharacteristicsList, "Технология", product.product_technology);
        addCharacteristic(productCharacteristicsList, "Цоколь", product.socket);
        addCharacteristic(productCharacteristicsList, "Мощность", `${parseFloat(product.power).toFixed(1)}W`);
        if(product.lumens) addCharacteristic(productCharacteristicsList, "Световой поток", `${product.lumens} Лм`);
        if(product.color_temperature) addCharacteristic(productCharacteristicsList, "Цветовая температура", `${product.color_temperature}K`);
        if(product.voltage) addCharacteristic(productCharacteristicsList, "Напряжение", product.voltage);
        if(product.class_energy_efficiency) addCharacteristic(productCharacteristicsList, "Класс энергоэффективности", product.class_energy_efficiency);
        // Добавьте другие характеристики по аналогии


        // 4. Галерея изображений
        if (product.images && product.images.length > 0) {
            mainProductImageEl.src = product.images[0].image_url;
            mainProductImageEl.alt = `${escapeHtml(product.name)} - вид 1`;

            productThumbnailsContainer.innerHTML = ''; // Очищаем старые миниатюры

            product.images.forEach((img, index) => {
                const thumbButton = document.createElement('button');
                thumbButton.className = 'product-gallery__thumb';
                if (index === 0) thumbButton.classList.add('active');
                thumbButton.setAttribute('aria-label', `Показать изображение ${index + 1}`);
                thumbButton.type = 'button';
                thumbButton.dataset.imageSrc = img.image_url; // URL из Product Service
                thumbButton.dataset.imageAlt = `${escapeHtml(product.name)} - вид ${index + 1}`;

                const thumbImg = document.createElement('img');
                thumbImg.src = img.image_url; // URL из Product Service
                thumbImg.alt = `Миниатюра: ${escapeHtml(product.name)} - вид ${index + 1}`;

                thumbButton.appendChild(thumbImg);
                productThumbnailsContainer.appendChild(thumbButton);
            });

            // Инициализация галереи (предполагаем, что window.initProductGallery есть в main.js)
            if (typeof window.initProductGallery === 'function') {
                window.initProductGallery('.product-gallery'); // Передаем селектор галереи
            } else {
                console.warn("initProductGallery function not found. Basic thumbnail click implemented.");
                // Базовая смена главного изображения по клику на миниатюру
                const thumbs = productThumbnailsContainer.querySelectorAll('.product-gallery__thumb');
                thumbs.forEach(thumb => {
                    thumb.addEventListener('click', () => {
                        if (mainProductImageEl.src !== thumb.dataset.imageSrc) {
                             mainProductImageEl.style.opacity = '0';
                             setTimeout(() => {
                                mainProductImageEl.src = thumb.dataset.imageSrc;
                                mainProductImageEl.alt = thumb.dataset.imageAlt;
                                mainProductImageEl.style.opacity = '1';
                             }, 150); // Соответствует transition в CSS
                        }
                        thumbs.forEach(t => t.classList.remove('active'));
                        thumb.classList.add('active');
                    });
                });
                // Также нужно инициализировать стрелки, если initProductGallery нет
                const prevButton = document.querySelector('.product-gallery__arrow--prev');
                const nextButton = document.querySelector('.product-gallery__arrow--next');
                if(prevButton && nextButton && product.images.length > 1) {
                    // Упрощенная логика для стрелок (требует доработки для currentImageIndex)
                    // Эта часть сложнее без полной логики initProductGallery
                } else if (prevButton && nextButton) {
                    prevButton.style.display = 'none';
                    nextButton.style.display = 'none';
                }

            }

        } else { // Если изображений нет
            mainProductImageEl.src = 'https://placehold.co/600x600/e9ecef/adb5bd?text=No+Image';
            mainProductImageEl.alt = escapeHtml(product.name);
            productThumbnailsContainer.innerHTML = '<p>Нет дополнительных изображений.</p>';
            const prevButton = document.querySelector('.product-gallery__arrow--prev');
            const nextButton = document.querySelector('.product-gallery__arrow--next');
            if(prevButton) prevButton.style.display = 'none';
            if(nextButton) nextButton.style.display = 'none';
        }

        // 5. Кнопка "Добавить в корзину"
        addToCartButton.onclick = () => { // Используем onclick для простоты, можно и addEventListener
            const quantity = parseInt(quantityInput.value, 10);
            if (isNaN(quantity) || quantity < 1) {
                alert("Пожалуйста, выберите корректное количество (минимум 1).");
                quantityInput.value = 1; // Сбрасываем на 1
                return;
            }
            // Вызываем addToCart из cart-logic.js
            if (typeof addToCart === 'function') {
                addToCart({
                    id: product.product_id,
                    name: product.name,
                    price: product.price, // Pydantic Decimal приходит как строка, addToCart ожидает число
                    image: (product.images && product.images.length > 0) ? product.images[0].image_url : ''
                }, quantity);

                // Простое уведомление и изменение кнопки
                const originalText = addToCartButton.textContent;
                addToCartButton.textContent = 'Добавлено!';
                addToCartButton.disabled = true;
                setTimeout(() => {
                    addToCartButton.textContent = originalText;
                    addToCartButton.disabled = false;
                }, 2000);

            } else {
                console.error("addToCart function is not defined!");
                alert("Ошибка: функция добавления в корзину не найдена.");
            }
        };

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