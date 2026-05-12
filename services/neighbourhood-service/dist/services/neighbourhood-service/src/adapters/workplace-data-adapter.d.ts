import { AvailabilitySlot, Desk, Floor, Neighbourhood, Office, TeamSeatingAssignment } from '@team-orbit/contracts';
export declare class WorkplaceDataAdapter {
    private readonly data;
    constructor();
    listNeighbourhoods(officeId: string): Promise<Neighbourhood[]>;
    listDesks(officeId: string): Promise<Desk[]>;
    getAvailability(officeId: string, date: string): Promise<AvailabilitySlot[]>;
    getFloors(officeId: string): Promise<Floor[]>;
    getOffice(): Promise<Office>;
    getTeamSeating(officeId: string): Promise<TeamSeatingAssignment[]>;
    private hashAvailability;
    private findOffice;
    private resolveWorkplaceFile;
}
