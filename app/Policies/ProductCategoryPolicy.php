<?php

namespace App\Policies;

use App\Models\ProductCategory;
use App\Models\User;

class ProductCategoryPolicy
{
    /**
     * Determine whether the user can view any product categories.
     * Both admin and staff can view for filtering purposes
     */
    public function viewAny(User $user): bool
    {
        return $user->hasRole('admin') || $user->hasRole('staff');
    }

    /**
     * Determine whether the user can view the product category.
     */
    public function view(User $user, ProductCategory $productCategory): bool
    {
        return $user->hasRole('admin') || $user->hasRole('staff');
    }

    /**
     * Determine whether the user can create product categories.
     * Only admin can create/modify category structure
     */
    public function create(User $user): bool
    {
        return $user->hasRole('admin');
    }

    /**
     * Determine whether the user can update the product category.
     */
    public function update(User $user, ProductCategory $productCategory): bool
    {
        return $user->hasRole('admin');
    }

    /**
     * Determine whether the user can toggle active status.
     */
    public function toggle(User $user, ProductCategory $productCategory): bool
    {
        return $user->hasRole('admin');
    }

    /**
     * Determine whether the user can delete the product category.
     */
    public function delete(User $user, ProductCategory $productCategory): bool
    {
        return $user->hasRole('admin');
    }
}
