export declare class GraphAuthClient {
    private config;
    constructor(config: {
        clientId: string;
        clientSecret: string;
        tenantId: string;
    });
    getAccessToken(): Promise<string>;
}
