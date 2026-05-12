import { CollaborationSignal, UserProfile } from '@team-orbit/contracts';
import { GraphAuthClient } from './graph-auth-client';
export declare class DirectoryAdapter {
    private graphClient;
    private users;
    constructor(graphClient: GraphAuthClient | null);
    getUser(userId: string): Promise<UserProfile | undefined>;
    listCollaborators(userId: string): Promise<UserProfile[]>;
    buildSignals(userId: string, collaboratorIds: string[]): Promise<CollaborationSignal[]>;
    private collaboratorRank;
}
