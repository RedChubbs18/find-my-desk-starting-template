"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectoryAdapter = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const contracts_1 = require("@team-orbit/contracts");
class DirectoryAdapter {
    constructor(graphClient) {
        this.graphClient = graphClient;
        const filePath = path_1.default.resolve(process.cwd(), '..', '..', 'data', 'users.json');
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        const rawUsers = JSON.parse(content);
        this.users = rawUsers.map((u) => ({
            id: (0, contracts_1.makeUserId)(u.id),
            email: u.email,
            displayName: u.fullName,
            team: u.team,
            role: u.role,
            location: u.location,
            lineManager: u.lineManager,
            anchorDays: u.anchorDays ?? [],
            defaultWorkingPattern: u.defaultWorkingPattern ?? {
                monday: 'office',
                tuesday: 'remote',
                wednesday: 'office',
                thursday: 'remote',
                friday: 'office',
            },
            preferredNeighbourhood: u.preferredNeighbourhood ?? 'Collaboration Zone',
            deskPreferences: u.deskPreferences ?? [],
            accessibilityNeeds: u.accessibilityNeeds ?? undefined,
            bookingWindowDays: u.bookingWindowDays ?? 14,
        }));
    }
    async getUser(userId) {
        const local = this.users.find((u) => u.id === (0, contracts_1.makeUserId)(userId));
        if (!this.graphClient || local) {
            return local;
        }
        // Graph integration can be expanded; currently we require this to avoid blocking MVP.
        await this.graphClient.getAccessToken();
        return undefined;
    }
    async listCollaborators(userId) {
        const me = await this.getUser(userId);
        if (!me) {
            return [];
        }
        return this.users
            .filter((u) => u.id !== me.id)
            .sort((a, b) => {
            const aScore = this.collaboratorRank(me, a);
            const bScore = this.collaboratorRank(me, b);
            return bScore - aScore;
        })
            .slice(0, 10);
    }
    async buildSignals(userId, collaboratorIds) {
        const me = await this.getUser(userId);
        if (!me) {
            return [];
        }
        const ids = collaboratorIds.map((id) => (0, contracts_1.makeUserId)(id));
        const collaborators = this.users.filter((u) => ids.includes(u.id));
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() - 14);
        const signals = collaborators.map((c) => ({
            sourceType: 'org',
            fromUserId: me.id,
            toUserId: c.id,
            score: this.collaboratorRank(me, c),
            dateWindow: { start, end: now },
        }));
        return signals;
    }
    collaboratorRank(me, other) {
        let score = 0.2;
        if (me.team === other.team) {
            score += 0.5;
        }
        if (me.lineManager?.email && me.lineManager.email === other.lineManager?.email) {
            score += 0.2;
        }
        if (me.location === other.location) {
            score += 0.1;
        }
        return Math.min(1, score);
    }
}
exports.DirectoryAdapter = DirectoryAdapter;
