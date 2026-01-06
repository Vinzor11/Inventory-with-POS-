<?php

namespace App\Policies;

use App\Models\Product;
use App\Models\User;

class ProductPolicy
{
    /**
     * Determine whether the user can view any products.
     * Both admin and staff need to view products for POS and inventory
     */
    public function viewAny(User $user): bool
    {
        return $user->hasRole('admin') || $user->hasRole('staff');
    }

    /**
     * Determine whether the user can view the product.
     */
    public function view(User $user, Product $product): bool
    {
        return $user->hasRole('admin') || $user->hasRole('staff');
    }

    /**
     * Determine whether the user can create products.
     * Only admin can create new product definitions
     */
    public function create(User $user): bool
    {
        return $user->hasRole('admin');
    }

    /**
     * Determine whether the user can update the product.
     */
    public function update(User $user, Product $product): bool
    {
        return $user->hasRole('admin');
    }

    /**
     * Determine whether the user can toggle stock tracking.
     */
    public function toggleStock(User $user, Product $product): bool
    {
        return $user->hasRole('admin');
    }

    /**
     * Determine whether the user can toggle active status.
     */
    public function toggleActive(User $user, Product $product): bool
    {
        return $user->hasRole('admin');
    }

    /**
     * Determine whether the user can delete the product.
     */
    public function delete(User $user, Product $product): bool
    {
        return $user->hasRole('admin');
    }
}
