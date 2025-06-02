const ADMIN_SERVICE_BASE_URL = 'http://localhost:8000/api/v1';


async function request(endpoint, method = 'GET', data = null, isFormData = false) {
    const token = getToken(); // Функция getToken() должна быть доступна (из auth.js или здесь)

    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method: method,
        headers: headers,
    };

    if (data) {
        if (isFormData) {
            // Для FormData Content-Type устанавливается браузером автоматически
            config.body = data;
        } else {
            headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(data);
        }
    }

    console.log(`Requesting: ${method} ${ADMIN_SERVICE_BASE_URL}${endpoint}`); // Логирование запроса

    try {
        const response = await fetch(`${ADMIN_SERVICE_BASE_URL}${endpoint}`, config);

        console.log(`Response status: ${response.status} for ${ADMIN_SERVICE_BASE_URL}${endpoint}`); // Логирование статуса

        if (response.status === 204) { // No Content
            return null; // Или какое-то другое обозначение успеха без тела
        }

        const responseData = await response.json().catch(err => {
            console.error("Failed to parse JSON response:", err);
            console.error("Response text:", response.text ? response.text() : "empty"); // Попытка прочитать текст
            // Если JSON не парсится, но статус ОК, возможно, это проблема
            if (response.ok) { // 200-299
                return { detail: "Received non-JSON response from server." }; // Вернем ошибку, чтобы обработать выше
            }
            return null; // Если и не JSON, и не OK, то response.ok будет false
        });

        if (!response.ok) {
            let errorMessage = `Ошибка ${response.status}`;
            if (responseData && responseData.detail) {
                if (typeof responseData.detail === 'string') {
                    errorMessage = responseData.detail;
                } else if (Array.isArray(responseData.detail) && responseData.detail.length > 0 && responseData.detail[0].msg) {
                     errorMessage = responseData.detail.map(d => d.msg).join(', ');
                } else {
                    errorMessage = JSON.stringify(responseData.detail);
                }
            } else if (responseData === null && response.status !== 204) {
                // Если responseData null (не удалось распарсить JSON), но статус не 204
                errorMessage = `Ошибка ${response.status}: Сервер вернул некорректный ответ.`;
            }

            console.error('API Error:', errorMessage, 'Response Data:', responseData);

            if (response.status === 401) { // Unauthorized
                console.log('Token invalid or expired, redirecting to login.');
                logout(); // Функция logout() должна быть доступна (из auth.js или здесь)
                // Не бросаем ошибку, чтобы logout успел сделать редирект
                return Promise.reject({ message: 'Unauthorized, redirecting...', status: 401 });
            }
            // Бросаем ошибку, чтобы ее можно было поймать в вызывающем коде
            const error = new Error(errorMessage);
            error.status = response.status;
            error.data = responseData;
            throw error;
        }
        return responseData;
    } catch (error) {
        console.error('Network or other error in request function:', error);
        // Если это не ошибка HTTP с сервера (например, нет сети)
        if (!error.status) { // Если у ошибки нет нашего кастомного статуса
            const networkError = new Error(error.message || 'Сетевая ошибка или сервер недоступен.');
            networkError.isNetworkError = true;
            throw networkError;
        }
        throw error; // Перебрасываем кастомную ошибку (с .status и .data) или ошибку от logout
    }
}


function getToken() {
    return localStorage.getItem('adminToken');
}

function logout() {
    localStorage.removeItem('adminToken');
    window.location.href = 'login.html';
}