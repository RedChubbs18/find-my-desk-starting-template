"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkplaceDataAdapter = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const contracts_1 = require("@team-orbit/contracts");
const DEFAULT_OFFICE_ID = (0, contracts_1.makeOfficeId)('office-london-mvp');
class WorkplaceDataAdapter {
    constructor() {
        const filePath = this.resolveWorkplaceFile();
        const fileContent = fs_1.default.readFileSync(filePath, 'utf-8');
        this.data = JSON.parse(fileContent);
    }
    async listNeighbourhoods(officeId) {
        const office = this.findOffice(officeId);
        return office.floors.flatMap((f) => f.neighbourhoods.map((n) => ({
            id: (0, contracts_1.makeNeighbourhoodId)(n.id),
            name: n.name,
            officeId: (0, contracts_1.makeOfficeId)(office.id),
            floorId: f.id,
            description: n.description,
            features: n.features,
            totalDesks: n.totalDesks,
        })));
    }
    async listDesks(officeId) {
        const neighbourhoods = await this.listNeighbourhoods(officeId);
        const desks = [];
        neighbourhoods.forEach((n) => {
            for (let i = 1; i <= n.totalDesks; i += 1) {
                desks.push({
                    id: (0, contracts_1.makeDeskId)(`${n.id}-desk-${i}`),
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
    async getAvailability(officeId, date) {
        const desks = await this.listDesks(officeId);
        return desks.map((desk, idx) => ({
            officeId: (0, contracts_1.makeOfficeId)(officeId),
            deskId: desk.id,
            date,
            isAvailable: this.hashAvailability(`${date}-${desk.id}-${idx}`),
            sourceTimestamp: new Date(),
        }));
    }
    async getFloors(officeId) {
        const office = this.findOffice(officeId);
        return office.floors.map((f) => ({
            id: f.id,
            number: f.number,
            neighbourhoods: f.neighbourhoods.map((n) => ({
                id: (0, contracts_1.makeNeighbourhoodId)(n.id),
                name: n.name,
                officeId: (0, contracts_1.makeOfficeId)(office.id),
                floorId: f.id,
                description: n.description,
                features: n.features,
                totalDesks: n.totalDesks,
            })),
        }));
    }
    async getOffice() {
        const office = this.findOffice(DEFAULT_OFFICE_ID);
        return {
            id: (0, contracts_1.makeOfficeId)(office.id),
            name: office.name,
            location: office.location,
            floors: await this.getFloors(office.id),
        };
    }
    async getTeamSeating(officeId) {
        const office = this.findOffice(officeId);
        return office.teamSeating.map((t) => ({
            teamId: t.teamId,
            officeId: (0, contracts_1.makeOfficeId)(office.id),
            neighbourhoodId: (0, contracts_1.makeNeighbourhoodId)(t.neighbourhoodId),
            primaryFloor: t.primaryFloor,
            members: t.members.map((m) => (0, contracts_1.makeUserId)(m)),
        }));
    }
    hashAvailability(input) {
        let hash = 0;
        for (let i = 0; i < input.length; i += 1) {
            hash = (hash << 5) - hash + input.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % 5 !== 0;
    }
    findOffice(officeId) {
        return (this.data.offices.find((o) => o.id === officeId) ||
            this.data.offices[0]);
    }
    resolveWorkplaceFile() {
        const candidates = [
            path_1.default.resolve(process.cwd(), '..', '..', 'data', 'workplace.json'),
            path_1.default.resolve(process.cwd(), 'data', 'workplace.json'),
            path_1.default.resolve(__dirname, '..', '..', '..', '..', 'data', 'workplace.json'),
        ];
        for (const candidate of candidates) {
            if (fs_1.default.existsSync(candidate)) {
                return candidate;
            }
        }
        throw new Error('Cannot locate data/workplace.json');
    }
}
exports.WorkplaceDataAdapter = WorkplaceDataAdapter;
