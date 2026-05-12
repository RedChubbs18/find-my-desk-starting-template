import { IPublicClientApplication } from '@azure/msal-browser';
export declare function setMsalInstance(instance: IPublicClientApplication): void;
export declare function getMe(): Promise<any>;
export declare function queryRecommendations(input: {
    officeId: string;
    bookingDate: string;
    collaborators: string[];
}): Promise<any>;
export declare function createBooking(input: {
    officeId: string;
    deskId: string;
    neighbourhoodId: string;
    bookingDate: string;
    collaboratorIds: string[];
}): Promise<any>;
export declare function listBookings(): Promise<any>;
