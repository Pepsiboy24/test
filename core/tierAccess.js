import { supabase } from './config.js';

// Tier constants
export const TIERS = {
    ADMIN_CORE: 1,
    STUDENT_ENGAGEMENT: 2,
    FULL_CONNECT: 3,
    ENTERPRISE: 4
};

// Feature definitions by tier
export const FEATURES = {
    // Auth & User Creation
    ADMIN_TEACHER_CREATION: {
        tier: TIERS.ADMIN_CORE,
        name: 'Admin & Teacher Creation'
    },
    STUDENT_CREATION: {
        tier: TIERS.STUDENT_ENGAGEMENT,
        name: 'Student Creation'
    },
    PARENT_CREATION: {
        tier: TIERS.FULL_CONNECT,
        name: 'Parent Creation'
    },
    
    // Dashboard & Features
    STUDENT_DASHBOARD: {
        tier: TIERS.STUDENT_ENGAGEMENT,
        name: 'Student Dashboard'
    },
    CBT_EXAMS: {
        tier: TIERS.STUDENT_ENGAGEMENT,
        name: 'CBT Exams/Materials'
    },
    PARENT_PORTAL: {
        tier: TIERS.FULL_CONNECT,
        name: 'Parent Portal'
    },
    AI_ASSISTANTS: {
        tier: TIERS.FULL_CONNECT,
        name: 'AI Assistants'
    },
    
    // Branding
    WHITE_LABELING: {
        tier: TIERS.ENTERPRISE,
        name: 'White-labeling'
    }
};

// Cache for tier data
let tierCache = new Map();
let cacheExpiry = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get school tier from database
async function getSchoolTier(schoolId) {
    if (!schoolId) return null;
    
    // Check cache first
    const cached = tierCache.get(schoolId);
    const expiry = cacheExpiry.get(schoolId);
    
    if (cached && expiry && Date.now() < expiry) {
        return cached;
    }
    
    try {
        const { data, error } = await supabase
            .from('Schools')
            .select('tier')
            .eq('school_id', schoolId)
            .single();
            
        if (error) {
            console.error('Error fetching school tier:', error);
            return null;
        }
        
        const tier = data?.tier || TIERS.ADMIN_CORE; // Default to tier 1
        
        // Cache the result
        tierCache.set(schoolId, tier);
        cacheExpiry.set(schoolId, Date.now() + CACHE_DURATION);
        
        return tier;
    } catch (err) {
        console.error('Unexpected error fetching school tier:', err);
        return null;
    }
}

// Check if user has access to a specific feature
export async function hasFeatureAccess(featureKey, userTier = null) {
    const feature = FEATURES[featureKey];
    if (!feature) {
        console.warn(`Feature ${featureKey} not defined`);
        return false;
    }
    
    // If userTier is provided, use it directly
    if (userTier !== null) {
        return userTier >= feature.tier;
    }
    
    // Otherwise, get tier from current user's school
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.user_metadata?.school_id) {
            return false;
        }
        
        const schoolTier = await getSchoolTier(user.user_metadata.school_id);
        return schoolTier !== null && schoolTier >= feature.tier;
    } catch (err) {
        console.error('Error checking feature access:', err);
        return false;
    }
}

// Get current user's tier
export async function getCurrentUserTier() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.user_metadata?.school_id) {
            return null;
        }
        
        return await getSchoolTier(user.user_metadata.school_id);
    } catch (err) {
        console.error('Error getting current user tier:', err);
        return null;
    }
}

// Check if user can create specific role
export async function canCreateRole(role) {
    const userTier = await getCurrentUserTier();
    if (!userTier) return false;
    
    switch (role.toLowerCase()) {
        case 'admin':
        case 'teacher':
            return userTier >= TIERS.ADMIN_CORE;
        case 'student':
            return userTier >= TIERS.STUDENT_ENGAGEMENT;
        case 'parent':
            return userTier >= TIERS.FULL_CONNECT;
        default:
            return false;
    }
}

// Get all available features for current user's tier
export async function getAvailableFeatures() {
    const userTier = await getCurrentUserTier();
    if (!userTier) return [];
    
    return Object.entries(FEATURES)
        .filter(([_, feature]) => userTier >= feature.tier)
        .map(([key, feature]) => ({ key, ...feature }));
}

// Clear cache (useful for testing or when tier changes)
export function clearTierCache() {
    tierCache.clear();
    cacheExpiry.clear();
}

// React-like hook for component usage
export function useTierAccess() {
    return {
        hasFeatureAccess,
        getCurrentUserTier,
        canCreateRole,
        getAvailableFeatures,
        clearTierCache,
        TIERS,
        FEATURES
    };
}

// Export for global usage
window.tierAccess = {
    hasFeatureAccess,
    getCurrentUserTier,
    canCreateRole,
    getAvailableFeatures,
    clearTierCache,
    TIERS,
    FEATURES
};
