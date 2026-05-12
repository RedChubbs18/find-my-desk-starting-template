"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreDesks = scoreDesks;
function scoreDesks(user, desks, availableDeskIds, collaboratorCount) {
    const ranked = desks
        .filter((d) => availableDeskIds.has(d.id))
        .map((desk) => {
        const factors = {
            preference: scorePreference(user, desk),
            accessibility: scoreAccessibility(user, desk),
            collaboration: scoreCollaboration(desk, collaboratorCount),
        };
        const score = factors.preference * 0.45 + factors.accessibility * 0.35 + factors.collaboration * 0.2;
        const rationale = `pref=${factors.preference.toFixed(2)} access=${factors.accessibility.toFixed(2)} collab=${factors.collaboration.toFixed(2)}`;
        return { desk, score, rationale };
    })
        .sort((a, b) => b.score - a.score);
    return ranked;
}
function scorePreference(user, desk) {
    let score = 0.3;
    const preferredNeighbourhood = user.preferredNeighbourhood.toLowerCase();
    if (desk.neighbourhoodId.toLowerCase().includes(preferredNeighbourhood.replace(/\s+/g, '-'))) {
        score += 0.4;
    }
    if (user.deskPreferences.some((p) => desk.features.includes(p))) {
        score += 0.3;
    }
    return Math.min(1, score);
}
function scoreAccessibility(user, desk) {
    if (!user.accessibilityNeeds) {
        return 0.8;
    }
    if (desk.features.includes(user.accessibilityNeeds) || desk.isAccessible) {
        return 1;
    }
    return 0.2;
}
function scoreCollaboration(desk, collaboratorCount) {
    if (collaboratorCount <= 0) {
        return 0.5;
    }
    const hasCollaborativeFeature = desk.features.includes('near-team') || desk.features.includes('collaboration');
    if (!hasCollaborativeFeature) {
        return Math.max(0.3, 0.7 - collaboratorCount * 0.05);
    }
    return Math.min(1, 0.7 + collaboratorCount * 0.05);
}
