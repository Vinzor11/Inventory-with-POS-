<?php

return [
    'store' => [
        'id' => (int) env('POS_STORE_ID', 1),
        'name' => env('POS_STORE_NAME', 'HIMS POS'),
    ],

    'currency' => env('POS_CURRENCY', 'PHP'),

    'tax' => [
        'mode' => env('POS_TAX_MODE', 'exclusive'),
        'rate' => (float) env('POS_TAX_RATE', 0),
        'price_precision' => (int) env('POS_PRICE_PRECISION', 2),
    ],

    'payment_methods' => [
        ['id' => 'cash', 'name' => 'Cash'],
        ['id' => 'gcash', 'name' => 'GCash'],
        ['id' => 'cheque', 'name' => 'Cheque'],
        ['id' => 'credit', 'name' => 'Credit'],
    ],

    'permissions' => [
        'admin' => [
            'pos.sell',
            'pos.void',
            'inventory.view',
            'inventory.adjust',
            'inventory.stock_in',
            'products.manage',
            'transactions.view',
            'reports.view',
            'settings.manage',
            'users.manage',
        ],
        'staff' => [
            'pos.sell',
            'inventory.view',
            'transactions.view',
        ],
        'default' => [
            'pos.sell',
        ],
    ],

    'pos_seed_limit' => (int) env('POS_BOOTSTRAP_SEED_LIMIT', 30),
];
