document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessageDiv = document.getElementById('errorMessage');
    const togglePasswordButton = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    // Проверяем, не залогинен ли уже пользователь
    if (getToken()) {
        window.location.href = 'admin_panel.html'; // Перенаправляем, если токен есть
        return;
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            errorMessageDiv.style.display = 'none';
            errorMessageDiv.textContent = '';

            const username = loginForm.username.value;
            const password = loginForm.password.value;

            // Используем x-www-form-urlencoded, как ожидает OAuth2PasswordRequestForm
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            try {
                const response = await fetch(`${ADMIN_SERVICE_BASE_URL}/auth/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData,
                });

                const data = await response.json();

                if (response.ok) {
                    saveToken(data.access_token);
                    window.location.href = 'admin_panel.html'; // Перенаправление на главную страницу админки
                } else {
                    let detail = "Ошибка авторизации.";
                    if (data.detail) {
                        if (typeof data.detail === 'string') {
                            detail = data.detail;
                        } else if (Array.isArray(data.detail) && data.detail.length > 0 && data.detail[0].msg) {
                            detail = data.detail[0].msg; // Для ошибок валидации FastAPI
                        } else if (typeof data.detail === 'object') {
                            detail = JSON.stringify(data.detail);
                        }
                    }
                    showError(detail);
                }
            } catch (error) {
                console.error('Login error:', error);
                showError('Сетевая ошибка или сервер недоступен.');
            }
        });
    }

    if (togglePasswordButton && passwordInput) {
        togglePasswordButton.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            // Можно менять иконку глаза
            togglePasswordButton.textContent = type === 'password' ? '👁️' : '🙈';
        });
    }

    function saveToken(token) {
        localStorage.setItem('adminToken', token);
    }

    function getToken() {
        return localStorage.getItem('adminToken');
    }

    function showError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
    }
});

// Глобальные функции для использования в других скриптах (если нужно вынести getToken)
function getToken() {
    return localStorage.getItem('adminToken');
}

function logout() {
    localStorage.removeItem('adminToken');
    window.location.href = 'login.html';
}