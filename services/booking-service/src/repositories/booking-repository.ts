import {
	Booking,
	BookingStatus,
	BookingStatusHistory,
	makeBookingId,
	makeNeighbourhoodId,
	makeOfficeId,
	makeDeskId,
	makeUserId,
} from '@team-orbit/contracts';

type CreateBookingInput = {
	userId: string;
	officeId: string;
	deskId: string;
	neighbourhoodId: string;
	bookingDate: string;
	collaboratorIds?: string[];
};

export class InMemoryBookingRepository {
	private bookings = new Map<string, Booking>();
	private history = new Map<string, BookingStatusHistory[]>();

	create(input: CreateBookingInput): Booking {
		const id = makeBookingId(`booking-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
		const now = new Date();
		const booking: Booking = {
			id,
			userId: makeUserId(input.userId),
			officeId: makeOfficeId(input.officeId),
			deskId: makeDeskId(input.deskId),
			neighbourhoodId: makeNeighbourhoodId(input.neighbourhoodId),
			bookingDate: input.bookingDate,
			status: BookingStatus.CONFIRMED,
			createdAt: now,
			updatedAt: now,
			collaboratorIds: (input.collaboratorIds ?? []).map((idValue) => makeUserId(idValue)),
		};

		this.bookings.set(id, booking);
		this.history.set(id, [
			{
				id: `h-${id}-1`,
				bookingId: id,
				previousStatus: BookingStatus.PENDING,
				newStatus: BookingStatus.CONFIRMED,
				changedBy: booking.userId,
				changedAt: now,
				reason: 'initial booking',
			},
		]);
		return booking;
	}

	findById(bookingId: string): Booking | undefined {
		return this.bookings.get(bookingId);
	}

	findByUserId(userId: string): Booking[] {
		return Array.from(this.bookings.values()).filter((b) => b.userId === makeUserId(userId));
	}

	findByDeskAndDate(deskId: string, bookingDate: string): Booking | undefined {
		return Array.from(this.bookings.values()).find(
			(b) => b.deskId === makeDeskId(deskId) && b.bookingDate === bookingDate && b.status === BookingStatus.CONFIRMED
		);
	}

	cancel(bookingId: string, changedBy: string, reason?: string): Booking | undefined {
		const booking = this.bookings.get(bookingId);
		if (!booking) {
			return undefined;
		}

		const previousStatus = booking.status;
		booking.status = BookingStatus.CANCELLED;
		booking.updatedAt = new Date();
		this.bookings.set(bookingId, booking);

		const changes = this.history.get(bookingId) ?? [];
		changes.push({
			id: `h-${bookingId}-${changes.length + 1}`,
			bookingId: booking.id,
			previousStatus,
			newStatus: BookingStatus.CANCELLED,
			changedBy: makeUserId(changedBy),
			changedAt: new Date(),
			reason: reason ?? 'cancelled by user',
		});
		this.history.set(bookingId, changes);
		return booking;
	}

	getHistory(bookingId: string): BookingStatusHistory[] {
		return this.history.get(bookingId) ?? [];
	}
}
