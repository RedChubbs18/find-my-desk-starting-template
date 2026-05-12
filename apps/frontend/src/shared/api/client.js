import axios from 'axios';
let msalInstance = null;
export function setMsalInstance(instance) {
    msalInstance = instance;
}
const api = axios.create({
    baseURL: '/api/v1',
});
api.interceptors.request.use(async (config) => {
    let token = 'dev-token';
    if (msalInstance) {
        try {
            const accounts = msalInstance.getAllAccounts();
            if (accounts.length > 0) {
                const result = await msalInstance.acquireTokenSilent({
                    account: accounts[0],
                    scopes: (import.meta.env.VITE_ENTRA_SCOPES || 'openid profile email').split(' '),
                });
                token = result.accessToken;
                console.log('Token acquired. Payload:', JSON.parse(atob(token.split('.')[1])));
            }
        }
        catch (error) {
            console.warn('Token acquisition failed, using dev-token:', error);
        }
    }
    config.headers.Authorization = `Bearer ${token}`;
    config.headers['x-correlation-id'] = crypto.randomUUID();
    return config;
});
export async function getMe() {
    const { data } = await api.get('/users/me');
    return data.data;
}
export async function queryRecommendations(input) {
    const { data } = await api.post('/recommendations/query', input);
    return data.data;
}
export async function createBooking(input) {
    const { data } = await api.post('/bookings', input);
    return data.data;
}
export async function listBookings() {
    const { data } = await api.get('/bookings');
    return data.data;
}
