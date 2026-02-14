<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\WeighInPrice;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class BootstrapController extends Controller
{
    public function __invoke(Request $request): JsonResponse|Response
    {
        $user = $request->user();
        $normalizedRole = $this->normalizeRole($user->role);

        $store = config('pos_bootstrap.store', []);
        $taxConfig = config('pos_bootstrap.tax', []);
        $paymentMethods = collect(config('pos_bootstrap.payment_methods', []))->values();
        $permissions = $this->resolvePermissions($normalizedRole);

        $categories = ProductCategory::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'updated_at']);

        $uom = $this->loadUomLookups();
        $posSeed = $this->loadPosSeed((int) config('pos_bootstrap.pos_seed_limit', 30));

        $categoriesUpdatedAt = $this->timestampOrZero(ProductCategory::query()->max('updated_at'));
        $productsUpdatedAt = $this->timestampOrZero(Product::query()->max('updated_at'));
        $variantsUpdatedAt = $this->timestampOrZero(ProductVariant::query()->max('updated_at'));
        $pricesUpdatedAt = $this->timestampOrZero(WeighInPrice::query()->max('updated_at'));
        $userUpdatedAt = $this->timestampOrZero($user->updated_at);

        $configSignature = sha1(json_encode([
            'store' => $store,
            'tax' => $taxConfig,
            'currency' => config('pos_bootstrap.currency', 'PHP'),
            'payment_methods' => $paymentMethods,
            'permissions' => $permissions,
            'uom' => $uom,
        ], JSON_UNESCAPED_SLASHES));

        $versionPayload = [
            'user_updated_at' => $userUpdatedAt,
            'categories_updated_at' => $categoriesUpdatedAt,
            'products_updated_at' => $productsUpdatedAt,
            'variants_updated_at' => $variantsUpdatedAt,
            'prices_updated_at' => $pricesUpdatedAt,
            'config_signature' => $configSignature,
        ];

        $etag = '"' . sha1(json_encode($versionPayload, JSON_UNESCAPED_SLASHES)) . '"';
        $lastModifiedTs = max($userUpdatedAt, $categoriesUpdatedAt, $productsUpdatedAt, $variantsUpdatedAt, $pricesUpdatedAt, 1);
        $lastModifiedHeader = Carbon::createFromTimestamp($lastModifiedTs)->toRfc7231String();

        if ($this->matchesEtag($request->header('If-None-Match'), $etag) ||
            $this->matchesIfModifiedSince($request->header('If-Modified-Since'), $lastModifiedTs)) {
            return response()->noContent(304)->withHeaders([
                'ETag' => $etag,
                'Last-Modified' => $lastModifiedHeader,
                'Cache-Control' => 'private, no-cache, must-revalidate',
            ]);
        }

        return response()->json([
            'server_time' => now()->toIso8601String(),
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $normalizedRole,
                'is_active' => (bool) $user->is_active,
            ],
            'branch' => [
                'id' => (int) ($store['id'] ?? 1),
                'name' => (string) ($store['name'] ?? 'HIMS POS'),
                'timezone' => config('app.timezone', 'UTC'),
                'currency' => (string) config('pos_bootstrap.currency', 'PHP'),
            ],
            'permissions' => $permissions,
            'config' => [
                'tax_mode' => (string) ($taxConfig['mode'] ?? 'exclusive'),
                'tax_rate' => (float) ($taxConfig['rate'] ?? 0),
                'price_precision' => (int) ($taxConfig['price_precision'] ?? 2),
            ],
            'lookups' => [
                'categories' => $categories,
                'payment_methods' => $paymentMethods,
                'uom' => $uom,
            ],
            'pos_seed' => $posSeed,
        ])->withHeaders([
            'ETag' => $etag,
            'Last-Modified' => $lastModifiedHeader,
            'Cache-Control' => 'private, no-cache, must-revalidate',
        ]);
    }

    private function resolvePermissions(string $role): array
    {
        $permissionsMap = config('pos_bootstrap.permissions', []);

        if (isset($permissionsMap[$role]) && is_array($permissionsMap[$role])) {
            return array_values($permissionsMap[$role]);
        }

        return array_values($permissionsMap['default'] ?? []);
    }

    private function normalizeRole(?string $role): string
    {
        $value = strtolower(trim((string) $role));

        if (in_array($value, ['admin', 'administrator', 'owner', 'manager'], true)) {
            return 'admin';
        }

        if (in_array($value, ['staff', 'cashier', 'employee'], true)) {
            return 'staff';
        }

        return $value !== '' ? $value : 'staff';
    }

    private function loadUomLookups(): array
    {
        $unitExpr = Schema::hasColumn('products', 'official_stock_unit')
            ? "DISTINCT COALESCE(NULLIF(TRIM(official_stock_unit), ''), NULLIF(TRIM(base_unit), ''), 'pcs') as unit_code"
            : "DISTINCT COALESCE(NULLIF(TRIM(base_unit), ''), 'pcs') as unit_code";

        $codes = Product::query()
            ->selectRaw($unitExpr)
            ->whereNotNull('base_unit')
            ->orderBy('unit_code')
            ->pluck('unit_code')
            ->filter(fn ($value) => is_string($value) && trim($value) !== '')
            ->values();

        return $codes
            ->map(function (string $code, int $index): array {
                return [
                    'id' => $index + 1,
                    'code' => strtolower(trim($code)),
                    'name' => strtoupper(trim($code)),
                ];
            })
            ->all();
    }

    private function loadPosSeed(int $limit): array
    {
        $productSelect = array_values(array_filter([
            'id',
            'category_id',
            'name',
            Schema::hasColumn('products', 'brand') ? 'brand' : null,
            'sku',
            Schema::hasColumn('products', 'image') ? 'image' : null,
            'base_unit',
            'track_stock',
            'is_active',
            'updated_at',
        ]));

        $variantSelect = array_values(array_filter([
            'id',
            'product_id',
            'description',
            'unit_price',
            'pending_unit_price',
            'pending_price_quantity',
            Schema::hasColumn('product_variants', 'cost_price') ? 'cost_price' : null,
            Schema::hasColumn('product_variants', 'purchase_price') ? 'purchase_price' : null,
        ]));

        $seedProducts = Product::query()
            ->where('is_active', true)
            ->whereHas('category', fn ($q) => $q->where('name', '!=', 'Agricultural Products'))
            ->with([
                'category:id,name',
                'variants' => function ($q) use ($variantSelect): void {
                    $q->select($variantSelect)
                        ->with('inventory:product_variant_id,quantity_on_hand');
                },
            ])
            ->select($productSelect)
            ->orderByDesc('updated_at')
            ->limit(max(1, $limit))
            ->get();

        $variantIds = $seedProducts->flatMap(fn ($product) => $product->variants->pluck('id'))->unique()->values()->all();
        $reservedByVariant = $this->reservedDeliveryQuantitiesByVariant($variantIds);

        return $seedProducts
            ->map(function (Product $product) use ($reservedByVariant): array {
                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'description' => $product->description,
                    'brand' => $product->brand,
                    'sku' => $product->sku,
                    'image' => $product->image,
                    'base_unit' => $product->base_unit,
                    'is_active' => (bool) $product->is_active,
                    'track_stock' => (bool) $product->track_stock,
                    'category' => $product->category ? [
                        'id' => $product->category->id,
                        'name' => $product->category->name,
                    ] : null,
                    'variants' => $product->variants->map(function (ProductVariant $variant) use ($reservedByVariant): array {
                        $attrs = $variant->getAttributes();
                        $costPrice = null;
                        if (array_key_exists('cost_price', $attrs) && $attrs['cost_price'] !== null) {
                            $costPrice = (float) $attrs['cost_price'];
                        } elseif (array_key_exists('purchase_price', $attrs) && $attrs['purchase_price'] !== null) {
                            $costPrice = (float) $attrs['purchase_price'];
                        }

                        $stock = (float) ($variant->inventory->quantity_on_hand ?? 0);
                        $reserved = (float) ($reservedByVariant[$variant->id] ?? 0);
                        return [
                            'id' => $variant->id,
                            'sku' => null,
                            'description' => $variant->description,
                            'unit_price' => (float) $variant->unit_price,
                            'pending_unit_price' => $variant->pending_unit_price !== null ? (float) $variant->pending_unit_price : null,
                            'pending_price_quantity' => $variant->pending_price_quantity !== null ? (float) $variant->pending_price_quantity : null,
                            'cost_price' => $costPrice,
                            'reserved_for_delivery' => $reserved,
                            'available_quantity' => max(0, $stock - $reserved),
                            'inventory' => [
                                'quantity_on_hand' => $stock,
                            ],
                        ];
                    })->values()->all(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  array<int>  $variantIds
     * @return array<int, float>
     */
    private function reservedDeliveryQuantitiesByVariant(array $variantIds): array
    {
        if (empty($variantIds)) {
            return [];
        }

        $refundSubquery = DB::table('refund_items')
            ->select('sale_item_id', DB::raw('SUM(quantity) as refunded_qty'))
            ->groupBy('sale_item_id');

        $reserved = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->leftJoinSub($refundSubquery, 'refund_totals', function ($join): void {
                $join->on('refund_totals.sale_item_id', '=', 'sale_items.id');
            })
            ->whereIn('sale_items.product_variant_id', $variantIds)
            ->where('sales.is_for_delivery', true)
            ->whereIn('sales.delivery_status', ['PENDING', 'PARTIAL'])
            ->where('sales.status', '!=', 'VOIDED')
            ->selectRaw(
                'sale_items.product_variant_id as variant_id, SUM(CASE WHEN (sale_items.quantity - COALESCE(sale_items.delivered_quantity, 0) - COALESCE(sale_items.canceled_quantity, 0) - COALESCE(refund_totals.refunded_qty, 0)) > 0 THEN (sale_items.quantity - COALESCE(sale_items.delivered_quantity, 0) - COALESCE(sale_items.canceled_quantity, 0) - COALESCE(refund_totals.refunded_qty, 0)) ELSE 0 END) as reserved_qty'
            )
            ->groupBy('sale_items.product_variant_id')
            ->pluck('reserved_qty', 'variant_id');

        return collect($reserved)
            ->mapWithKeys(fn ($value, $variantId): array => [(int) $variantId => (float) $value])
            ->all();
    }

    private function timestampOrZero(mixed $value): int
    {
        if (empty($value)) {
            return 0;
        }

        return Carbon::parse($value)->timestamp;
    }

    private function matchesEtag(?string $ifNoneMatchHeader, string $etag): bool
    {
        if ($ifNoneMatchHeader === null || trim($ifNoneMatchHeader) === '') {
            return false;
        }

        $headerTags = collect(explode(',', $ifNoneMatchHeader))
            ->map(static fn (string $tag): string => trim($tag))
            ->map(static function (string $tag): string {
                return str_starts_with($tag, 'W/') ? substr($tag, 2) : $tag;
            });

        return $headerTags->contains($etag);
    }

    private function matchesIfModifiedSince(?string $headerValue, int $versionTimestamp): bool
    {
        if ($headerValue === null || trim($headerValue) === '' || $versionTimestamp <= 0) {
            return false;
        }

        try {
            $headerTs = Carbon::parse($headerValue)->timestamp;
            return $headerTs >= $versionTimestamp;
        } catch (\Throwable) {
            return false;
        }
    }
}
