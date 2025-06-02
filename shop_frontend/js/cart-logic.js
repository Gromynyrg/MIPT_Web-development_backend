const CART_STORAGE_KEY = 'lampochkaShopCart';

function getCartItems() {
    const cartJson = localStorage.getItem(CART_STORAGE_KEY);
    try {
        return cartJson ? JSON.parse(cartJson) : [];
    } catch (e) {
        console.error("Error parsing cart from localStorage:", e);
        return [];
    }
}

function saveCartItems(cartItems) {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
        updateCartIcon();
    } catch (e) {
        console.error("Error saving cart to localStorage:", e);
    }
}

function addToCart(productDetails, quantityToAdd = 1) {
    if (!productDetails || !productDetails.id || !productDetails.name || typeof productDetails.price === 'undefined') {
        console.error("Invalid product details for addToCart:", productDetails);
        return;
    }
    const cart = getCartItems();
    const existingItemIndex = cart.findIndex(item => item.id === productDetails.id);
    const qtyToAdd = parseInt(quantityToAdd, 10);
    if (isNaN(qtyToAdd) || qtyToAdd < 1) qtyToAdd = 1;


    if (existingItemIndex > -1) {
        cart[existingItemIndex].quantity = (cart[existingItemIndex].quantity || 0) + qtyToAdd;
    } else {
        cart.push({
            id: productDetails.id,
            name: productDetails.name,
            price: parseFloat(productDetails.price),
            image: productDetails.image || 'https://placehold.co/100x100/e9ecef/adb5bd?text=N/A',
            quantity: qtyToAdd,
            selected: true // Новый товар по умолчанию выбран
        });
    }
    saveCartItems(cart);
    console.log("Cart updated (addToCart):", getCartItems());
}

function updateCartItemQuantity(productId, newQuantity) {
    const cart = getCartItems();
    const itemIndex = cart.findIndex(item => item.id === productId);
    const qty = parseInt(newQuantity, 10);

    if (itemIndex > -1) {
        if (qty > 0) {
            cart[itemIndex].quantity = qty;
        } else { // Если количество 0 или меньше, удаляем товар
            cart.splice(itemIndex, 1);
        }
        saveCartItems(cart);
    }
    console.log("Cart updated (updateCartItemQuantity):", getCartItems());
}

function removeFromCart(productId) {
    let cart = getCartItems();
    cart = cart.filter(item => item.id !== productId);
    saveCartItems(cart);
    console.log("Cart updated (removeFromCart):", getCartItems());
}

function toggleItemSelected(productId, selected) {
    const cart = getCartItems();
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        cart[itemIndex].selected = selected;
        saveCartItems(cart);
    }
}

function toggleSelectAllItems(selectAllChecked) {
    const cart = getCartItems();
    cart.forEach(item => item.selected = selectAllChecked);
    saveCartItems(cart);
}


function clearCart() {
    saveCartItems([]);
    console.log("Cart cleared");
}

function updateCartIcon() {
    const cart = getCartItems();
    const totalQuantity = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const cartLink = document.querySelector('.header__cart-link');
    if (cartLink) {
        const existingBadge = cartLink.querySelector('.cart-badge');
        if (existingBadge) existingBadge.remove();
        if (totalQuantity > 0) {
            const badge = document.createElement('span');
            badge.className = 'cart-badge';
            badge.textContent = totalQuantity;
            cartLink.appendChild(badge);
            cartLink.classList.add('has-items');
        } else {
            cartLink.classList.remove('has-items');
        }
    }
}
// Инициализация при загрузке скрипта
document.addEventListener('DOMContentLoaded', updateCartIcon);