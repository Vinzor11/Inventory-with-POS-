<?php

namespace App\Policies;

use App\Models\Sale;
use App\Models\User;

class SalePolicy
{
    /**
     * Determine whether the user can void the sale.
     * 
     * VOID AUTHORIZATION RULES:
     * - Only Admin or Manager roles can void sales
     * - Sale must meet all void eligibility criteria (checked in controller)
     */
    public function void(User $user, Sale $sale): bool
    {
        // Only Admin or Manager can void sales
        return $user->hasRole('admin') || $user->hasRole('manager');
    }

    /**
     * Determine whether the user can view the sale.
     */
    public function view(User $user, Sale $sale): bool
    {
        // Both admin and staff can view sales
        return $user->hasRole('admin') || $user->hasRole('staff');
    }

    /**
     * Determine whether the user can update the sale.
     * VOIDED sales are immutable and cannot be modified.
     */
    public function update(User $user, Sale $sale): bool
    {
        // VOIDED sales cannot be modified
        if ($sale->status === 'VOIDED') {
            return false;
        }
        
        // Only admin can update sales
        return $user->hasRole('admin');
    }
}

