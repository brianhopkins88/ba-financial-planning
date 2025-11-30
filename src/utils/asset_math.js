/**
 * ASSET PROJECTION ENGINE
 * Handles specific growth logic for different asset classes.
 */

export const calculateAssetGrowth = (asset, globalParams, horizonYears = 35) => {
    // Default fallback
    if (!asset || !asset.type) return [];

    switch (asset.type) {
        case 'property':
            return projectHomeValue(asset, globalParams, horizonYears);
        default:
            return projectSimpleGrowth(asset, globalParams, horizonYears);
    }
};

/**
 * HOME VALUE PROJECTION ALGORITHM
 * Projects nominal home value using age-sensitive appreciation phases.
 *
 * Inputs from Asset:
 * - value (current_value)
 * - inputs.buildYear
 * - inputs.zipCode (metadata only)
 *
 * Inputs from Global Params (assumptions):
 * - macro_baseline_growth (default 0.02)
 * - new_home_years (5)
 * - mid_age_years (15)
 * - new_home_addon (0.015)
 * - mid_age_addon (0.007)
 * - mature_age_addon (0.0)
 * - location_factor (0.0)
 * - min_growth (0.0)
 * - max_growth (0.04)
 */
export const projectHomeValue = (asset, globals, horizonYears) => {
    const startYear = globals.timing?.startYear || new Date().getFullYear();
    const currentValue = asset.balance || 0;
    const buildYear = asset.inputs?.buildYear || (startYear - 10); // Default to 10yo home if missing

    // Algorithm Parameters (with defaults from requirements)
    const baseline = globals.market?.baselineGrowth || 0.02;
    const newYears = 5;
    const midYears = 15;
    const newAddon = 0.015;
    const midAddon = 0.007;
    const matureAddon = 0.0;
    const locationFactor = asset.inputs?.locationFactor || 0.0;
    const minGrowth = 0.0;
    const maxGrowth = 0.04;

    const projection = [];
    let currentVal = currentValue;

    // Home Age at Start
    const initialAge = startYear - buildYear;

    for (let t = 0; t <= horizonYears; t++) {
        const year = startYear + t;
        const ageAtYearT = initialAge + t;

        // Determine Growth Bucket
        let bucket = 'mature';
        let growthRate = baseline + matureAddon;

        if (ageAtYearT <= newYears) {
            bucket = 'new';
            growthRate = baseline + newAddon;
        } else if (ageAtYearT <= (newYears + midYears)) {
            bucket = 'mid';
            growthRate = baseline + midAddon;
        }

        // Apply Factors & Clamp
        growthRate += locationFactor;
        if (growthRate < minGrowth) growthRate = minGrowth;
        if (growthRate > maxGrowth) growthRate = maxGrowth;

        // Record Data
        projection.push({
            year,
            age: ageAtYearT,
            value: currentVal,
            growthRate: growthRate,
            bucket
        });

        // Advance Value
        currentVal = currentVal * (1 + growthRate);
    }

    return projection;
};

/**
 * SIMPLE COMPOUND GROWTH
 * Used for Investment Accounts for visualization purposes.
 */
export const projectSimpleGrowth = (asset, globals, horizonYears) => {
    const startYear = globals.timing?.startYear || new Date().getFullYear();
    const rate = asset.growthType === 'fixed' ? (asset.fixedRate || 0) : (globals.market?.initial || 0.07);
    let balance = asset.balance || 0;
    const projection = [];

    for (let t = 0; t <= horizonYears; t++) {
        projection.push({
            year: startYear + t,
            value: balance,
            growthRate: rate
        });
        balance = balance * (1 + rate);
    }
    return projection;
};