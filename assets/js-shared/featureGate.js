
export const FeatureGate = {
    // Check if the school has a valid subscription
    async isAccountActive(schoolId) {
        const { data, error } = await supabase
            .from('Schools')
            .select('subscription_status, subscription_expires_at')
            .eq('school_id', schoolId)
            .single();

        if (error || !data) return false;

        const isStatusActive = data.subscription_status === 'active' || data.subscription_status === 'trial';
        const isNotExpired = new Date(data.subscription_expires_at) > new Date();

        return isStatusActive && isNotExpired;
    },

    // Check if a specific feature (like AI Assistant) is in their plan
    canAccessFeature(plan, featureName) {
        const plans = {
            'basic': ['attendance', 'grading', 'payments'],
            'premium': ['attendance', 'grading', 'payments', 'ai_assistant', 'cbt_engine']
        };
        return plans[plan]?.includes(featureName) || false;
    }
};