import axios from 'axios';
import { IPublicClientApplication } from '@azure/msal-browser';

let msalInstance: IPublicClientApplication | null = null;

export function setMsalInstance(instance: IPublicClientApplication) {
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
				// Request our API scope to get a token with the correct audience.
				// Falls back to OIDC scopes if the API scope is not yet exposed in Entra.
				const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE || `${import.meta.env.VITE_ENTRA_CLIENT_ID}/.default`;
				const oidcScopes = (import.meta.env.VITE_ENTRA_SCOPES || 'openid profile email').split(' ');
				let result;
				try {
					result = await msalInstance.acquireTokenSilent({
						account: accounts[0],
						scopes: [apiScope],
					});
				} catch {
					// Fall back to OIDC scopes if API scope unavailable
					result = await msalInstance.acquireTokenSilent({
						account: accounts[0],
						scopes: oidcScopes,
					});
				}
				// Prefer access token; fall back to ID token if access token has wrong audience
				token = result.accessToken || result.idToken;
				try {
					console.log('Token acquired. Payload:', JSON.parse(atob(token.split('.')[1])));
				} catch { /* ignore decode errors in logging */ }
			}
		} catch (error) {
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

export async function queryRecommendations(input: {
	officeId: string;
	bookingDate: string;
	collaborators: string[];
}) {
	const { data } = await api.post('/recommendations/query', input);
	return data.data;
}

export async function createBooking(input: {
	officeId: string;
	deskId: string;
	neighbourhoodId: string;
	bookingDate: string;
	collaboratorIds: string[];
}) {
	const { data } = await api.post('/bookings', input);
	return data.data;
}

export async function listBookings() {
	const { data } = await api.get('/bookings');
	return data.data;
}
