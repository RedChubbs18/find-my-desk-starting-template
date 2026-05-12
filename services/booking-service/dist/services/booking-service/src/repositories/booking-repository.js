"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryBookingRepository = void 0;
const contracts_1 = require("@team-orbit/contracts");
class InMemoryBookingRepository {
    constructor() {
        this.bookings = new Map();
        this.history = new Map();
    }
    create(input) {
        const id = (0, contracts_1.makeBookingId)(`booking-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
        const now = new Date();
        const booking = {
            id,
            userId: (0, contracts_1.makeUserId)(input.userId),
            officeId: (0, contracts_1.makeOfficeId)(input.officeId),
            deskId: (0, contracts_1.makeDeskId)(input.deskId),
            neighbourhoodId: (0, contracts_1.makeNeighbourhoodId)(input.neighbourhoodId),
            bookingDate: input.bookingDate,
            status: contracts_1.BookingStatus.CONFIRMED,
            createdAt: now,
            updatedAt: now,
            collaboratorIds: (input.collaboratorIds ?? []).map((idValue) => (0, contracts_1.makeUserId)(idValue)),
        };
        this.bookings.set(id, booking);
        this.history.set(id, [
            {
                id: `h-${id}-1`,
                bookingId: id,
                previousStatus: contracts_1.BookingStatus.PENDING,
                newStatus: contracts_1.BookingStatus.CONFIRMED,
                changedBy: booking.userId,
                changedAt: now,
                reason: 'initial booking',
            },
        ]);
        return booking;
    }
    findById(bookingId) {
        return this.bookings.get(bookingId);
    }
    findByUserId(userId) {
        return Array.from(this.bookings.values()).filter((b) => b.userId === (0, contracts_1.makeUserId)(userId));
    }
    findByDeskAndDate(deskId, bookingDate) {
        return Array.from(this.bookings.values()).find((b) => b.deskId === (0, contracts_1.makeDeskId)(deskId) && b.bookingDate === bookingDate && b.status === contracts_1.BookingStatus.CONFIRMED);
    }
    cancel(bookingId, changedBy, reason) {
        const booking = this.bookings.get(bookingId);
        if (!booking) {
            return undefined;
        }
        const previousStatus = booking.status;
        booking.status = contracts_1.BookingStatus.CANCELLED;
        booking.updatedAt = new Date();
        this.bookings.set(bookingId, booking);
        const changes = this.history.get(bookingId) ?? [];
        changes.push({
            id: `h-${bookingId}-${changes.length + 1}`,
            bookingId: booking.id,
            previousStatus,
            newStatus: contracts_1.BookingStatus.CANCELLED,
            changedBy: (0, contracts_1.makeUserId)(changedBy),
            changedAt: new Date(),
            reason: reason ?? 'cancelled by user',
        });
        this.history.set(bookingId, changes);
        return booking;
    }
    getHistory(bookingId) {
        return this.history.get(bookingId) ?? [];
    }
}
exports.InMemoryBookingRepository = InMemoryBookingRepository;
