<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, TwoFactorAuthenticatable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'pin',
        'role',
        'is_active',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'pin',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'pin' => 'hashed',
            'is_active' => 'boolean',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    /**
     * Get the accessor for checking if PIN exists.
     */
    public function getHasPinAttribute(): bool
    {
        return !empty($this->attributes['pin']);
    }

    /**
     * Check if user has a specific role
     * 
     * Roles:
     * - 'admin': Can void sales, manage inventory, stock-in, adjustments
     * - 'staff': Can create sales, view inventory
     */
    public function hasRole(string $role): bool
    {
        $normalizedRequestedRole = $this->normalizeRole($role);

        if ($normalizedRequestedRole === 'admin') {
            return $this->isAdmin();
        }

        if ($normalizedRequestedRole === 'staff') {
            return $this->isStaff();
        }

        return $this->normalizeRole($this->role) === $normalizedRequestedRole;
    }

    /**
     * Check if user is an admin
     */
    public function isAdmin(): bool
    {
        return in_array(
            $this->normalizeRole($this->role),
            ['admin', 'administrator', 'owner', 'manager'],
            true
        );
    }

    /**
     * Check if user is staff
     */
    public function isStaff(): bool
    {
        return in_array(
            $this->normalizeRole($this->role),
            ['staff', 'cashier', 'employee'],
            true
        );
    }

    /**
     * Scope active users.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Check if user is active.
     */
    public function isActive(): bool
    {
        return (bool) $this->is_active;
    }

    /**
     * Resolve an active user by PIN.
     */
    public static function findActiveByPin(string $pin): ?self
    {
        $normalizedPin = trim($pin);
        if ($normalizedPin === '') {
            return null;
        }

        return self::query()
            ->active()
            ->whereNotNull('pin')
            ->get()
            ->first(function (self $user) use ($normalizedPin): bool {
                $pinHash = $user->getRawOriginal('pin');

                return !empty($pinHash) && Hash::check($normalizedPin, $pinHash);
            });
    }

    private function normalizeRole(?string $role): ?string
    {
        if ($role === null) {
            return null;
        }

        $normalized = strtolower(trim($role));
        return $normalized !== '' ? $normalized : null;
    }
}
