async function apiClientRequest(baseUrl, endpoint, method = 'GET', data = null) {
    const config = {
        method: method,
        headers: {},
    };

    if (data) {
        config.headers['Content-Type'] = 'application/json';
        config.body = JSON.stringify(data);
    }

    console.log(`Client Requesting: ${method} ${baseUrl}${endpoint}`);

    try {
        const response = await fetch(`${baseUrl}${endpoint}`, config);

        console.log(`Client Response status: ${response.status} for ${baseUrl}${endpoint}`);

        if (response.status === 204) {
            return null;
        }

        const responseData = await response.json().catch(err => {
            console.error("Client: Failed to parse JSON response:", err);
            console.error("Client: Response text:", response.text ? response.text() : "empty");
            if (response.ok) {
                return { detail: "Received non-JSON response from server." };
            }
            return null;
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
                errorMessage = `Ошибка ${response.status}: Сервер вернул некорректный ответ.`;
            }

            console.error('Client API Error:', errorMessage, 'Response Data:', responseData);
            const error = new Error(errorMessage);
            error.status = response.status;
            error.data = responseData;
            throw error;
        }
        return responseData;
    } catch (error) {
        console.error('Client: Network or other error in request function:', error);
        if (!error.status) {
            const networkError = new Error(error.message || 'Сетевая ошибка или сервер недоступен при обращении к сервису.');
            networkError.isNetworkError = true;
            throw networkError;
        }
        throw error;
    }
}