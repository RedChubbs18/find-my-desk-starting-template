import { Desk, UserProfile } from '@team-orbit/contracts';
type RankedDesk = {
    desk: Desk;
    score: number;
    rationale: string;
};
export declare function scoreDesks(user: UserProfile, desks: Desk[], availableDeskIds: Set<string>, collaboratorCount: number): RankedDesk[];
export {};
