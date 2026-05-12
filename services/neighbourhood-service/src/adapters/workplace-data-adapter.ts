import fs from 'fs';
import path from 'path';
import {
  AvailabilitySlot,
  Desk,
  Floor,
  Neighbourhood,
  Office,
  TeamSeatingAssignment,
  makeDeskId,
  makeNeighbourhoodId,
  makeOfficeId,
  makeUserId,
} from '@team-orbit/contracts';

type RawNeighbourhood = {
  id: string;
  name: string;
  description: string;
  features: string[];
  totalDesks: number;
};

type RawFloor = {
  id: string;
  number: number;
  neighbourhoods: RawNeighbourhood[];
};

type RawTeamSeating = {
  teamId: string;
  neighbourhoodId: string;
  primaryFloor: string;
  members: string[];
};

type RawOffice = {
  id: string;
  name: string;
  location: string;
  floors: RawFloor[];
  teamSeating: RawTeamSeating[];
};

type WorkplaceFile = {
  offices: RawOffice[];
};

const DEFAULT_OFFICE_ID = makeOfficeId('office-london-mvp');

export class WorkplaceDataAdapter {
  private readonly data: WorkplaceFile;

  constructor() {
    const filePath = this.resolveWorkplaceFile();
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    this.data = JSON.parse(fileContent) as WorkplaceFile;
  }

  async listNeighbourhoods(officeId: string): Promise<Neighbourhood[]> {
    const office = this.findOffice(officeId);
    return office.floors.flatMap((f) =>
      f.neighbourhoods.map((n) => ({
        id: makeNeighbourhoodId(n.id),
        name: n.name,
        officeId: makeOfficeId(office.id),
        floorId: f.id,
        description: n.description,
        features: n.features,
        totalDesks: n.totalDesks,
      }))
    );
  }

  async listDesks(officeId: string): Promise<Desk[]> {
    const neighbourhoods = await this.listNeighbourhoods(officeId);
    const desks: Desk[] = [];

    neighbourhoods.forEach((n) => {
      for (let i = 1; i <= n.totalDesks; i += 1) {
        desks.push({
          id: makeDeskId(`${n.id}-desk-${i}`),
          neighbourhoodId: n.id,
          officeId: n.officeId,
          floorId: n.floorId,
          deskNumber: `${n.name.slice(0, 3).toUpperCase()}-${i}`,
          features: n.features,
          isAccessible: n.features.includes('accessible-desk'),
        });
      }
    });

    return desks;
  }

  async getAvailability(officeId: string, date: string): Promise<AvailabilitySlot[]> {
    const desks = await this.listDesks(officeId);
    return desks.map((desk, idx) => ({
      officeId: makeOfficeId(officeId),
      deskId: desk.id,
      date,
      isAvailable: this.hashAvailability(`${date}-${desk.id}-${idx}`),
      sourceTimestamp: new Date(),
    }));
  }

  async getFloors(officeId: string): Promise<Floor[]> {
    const office = this.findOffice(officeId);
    return office.floors.map((f) => ({
      id: f.id,
      number: f.number,
      neighbourhoods: f.neighbourhoods.map((n) => ({
        id: makeNeighbourhoodId(n.id),
        name: n.name,
        officeId: makeOfficeId(office.id),
        floorId: f.id,
        description: n.description,
        features: n.features,
        totalDesks: n.totalDesks,
      })),
    }));
  }

  async getOffice(): Promise<Office> {
    const office = this.findOffice(DEFAULT_OFFICE_ID);
    return {
      id: makeOfficeId(office.id),
      name: office.name,
      location: office.location,
      floors: await this.getFloors(office.id),
    };
  }

  async getTeamSeating(officeId: string): Promise<TeamSeatingAssignment[]> {
    const office = this.findOffice(officeId);
    return office.teamSeating.map((t) => ({
      teamId: t.teamId,
      officeId: makeOfficeId(office.id),
      neighbourhoodId: makeNeighbourhoodId(t.neighbourhoodId),
      primaryFloor: t.primaryFloor,
      members: t.members.map((m) => makeUserId(m)),
    }));
  }

  private hashAvailability(input: string): boolean {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 5 !== 0;
  }

  private findOffice(officeId: string): RawOffice {
    return (
      this.data.offices.find((o) => o.id === officeId) ||
      this.data.offices[0]
    );
  }

  private resolveWorkplaceFile(): string {
    const candidates = [
      path.resolve(process.cwd(), '..', '..', 'data', 'workplace.json'),
      path.resolve(process.cwd(), 'data', 'workplace.json'),
      path.resolve(__dirname, '..', '..', '..', '..', 'data', 'workplace.json'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error('Cannot locate data/workplace.json');
  }
}
