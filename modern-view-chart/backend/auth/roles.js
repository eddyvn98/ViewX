const ALLOWED_ROLES = new Set(["viewer", "trader", "admin"]);

export function normalizeUserRole(role) {
    const raw = String(role || "").trim().toLowerCase();
    if (raw === "owner") return "admin";
    if (raw === "user") return "viewer";
    if (ALLOWED_ROLES.has(raw)) return raw;
    return "viewer";
}

export function isRoleAllowed(role) {
    return ALLOWED_ROLES.has(normalizeUserRole(role));
}

export function hasRequiredRole(currentRole, requiredRole) {
    const order = {
        viewer: 1,
        trader: 2,
        admin: 3,
    };
    return order[normalizeUserRole(currentRole)] >= order[normalizeUserRole(requiredRole)];
}
