import fs from 'fs';
import path from 'path';
import {
	CollaborationSignal,
	UserProfile,
	makeUserId,
	UserId,
} from '@team-orbit/contracts';
import { GraphAuthClient } from './graph-auth-client';

type RawUser = {
	id: string;
	fullName: string;
	email: string;
	team: string;
	role: string;
	location: string;
	lineManager?: { name: string; email: string };
	anchorDays?: string[];
	defaultWorkingPattern?: Record<string, 'office' | 'remote'>;
	preferredNeighbourhood?: string;
	deskPreferences?: string[];
	accessibilityNeeds?: string | null;
	bookingWindowDays?: number;
};

export class DirectoryAdapter {
	private users: UserProfile[];

	constructor(private graphClient: GraphAuthClient | null) {
		const filePath = path.resolve(process.cwd(), '..', '..', 'data', 'users.json');
		const content = fs.readFileSync(filePath, 'utf-8');
		const rawUsers = JSON.parse(content) as RawUser[];
		this.users = rawUsers.map((u) => ({
			id: makeUserId(u.id),
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

	async getUser(userId: string): Promise<UserProfile | undefined> {
		const local = this.users.find((u) => u.id === makeUserId(userId));
		if (!this.graphClient || local) {
			return local;
		}

		// Graph integration can be expanded; currently we require this to avoid blocking MVP.
		await this.graphClient.getAccessToken();
		return undefined;
	}

	async listCollaborators(userId: string): Promise<UserProfile[]> {
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

	async buildSignals(userId: string, collaboratorIds: string[]): Promise<CollaborationSignal[]> {
		const me = await this.getUser(userId);
		if (!me) {
			return [];
		}

		const ids = collaboratorIds.map((id) => makeUserId(id));
		const collaborators = this.users.filter((u) => ids.includes(u.id));
		const now = new Date();
		const start = new Date(now);
		start.setDate(start.getDate() - 14);

		const signals: CollaborationSignal[] = collaborators.map((c) => ({
			sourceType: 'org',
			fromUserId: me.id,
			toUserId: c.id,
			score: this.collaboratorRank(me, c),
			dateWindow: { start, end: now },
		}));

		return signals;
	}

	private collaboratorRank(me: UserProfile, other: UserProfile): number {
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
