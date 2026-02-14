<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Coconut to Copra Yield Guardrails
    |--------------------------------------------------------------------------
    |
    | These thresholds are used only for piece-to-kilogram production runs
    | (for example: Coconut pcs -> Uncooked Copra kg).
    |
    */
    'warn_kg_per_pc' => (float) env('PRODUCTION_WARN_KG_PER_PC', 0.40),
    'max_kg_per_pc' => (float) env('PRODUCTION_MAX_KG_PER_PC', 0.60),
];

