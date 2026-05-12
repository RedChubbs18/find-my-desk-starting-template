import { Booking, BookingStatusHistory } from '@team-orbit/contracts';
type CreateBookingInput = {
    userId: string;
    officeId: string;
    deskId: string;
    neighbourhoodId: string;
    bookingDate: string;
    collaboratorIds?: string[];
};
export declare class InMemoryBookingRepository {
    private bookings;
    private history;
    create(input: CreateBookingInput): Booking;
    findById(bookingId: string): Booking | undefined;
    findByUserId(userId: string): Booking[];
    findByDeskAndDate(deskId: string, bookingDate: string): Booking | undefined;
    cancel(bookingId: string, changedBy: string, reason?: string): Booking | undefined;
    getHistory(bookingId: string): BookingStatusHistory[];
}
export {};
