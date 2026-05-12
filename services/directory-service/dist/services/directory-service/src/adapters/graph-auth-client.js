"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphAuthClient = void 0;
class GraphAuthClient {
    constructor(config) {
        this.config = config;
    }
    async getAccessToken() {
        const tokenEndpoint = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
        const params = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            scope: 'https://graph.microsoft.com/.default',
        });
        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        if (!response.ok) {
            throw new Error(`Graph token acquisition failed: ${response.statusText}`);
        }
        const data = (await response.json());
        return data.access_token;
    }
}
exports.GraphAuthClient = GraphAuthClient;
