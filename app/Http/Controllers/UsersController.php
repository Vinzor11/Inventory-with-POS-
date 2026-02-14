<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class UsersController extends Controller
{
    private function authorizeAdmin(Request $request): void
    {
        if (!$request->user()?->isAdmin()) {
            abort(403, 'Only administrators can manage users.');
        }
    }

    /**
     * Display a listing of users.
     */
    public function index(Request $request): Response
    {
        $this->authorizeAdmin($request);

        $perPage = $request->integer('per_page', 10);

        $users = User::query()
            ->when($request->search, function ($query, $search) {
                $query->where('name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%");
            })
            ->paginate($perPage)
            ->withQueryString();

        // Make PIN visible (it's hashed, so safe) and append has_pin accessor to each user
        $users->getCollection()->transform(function ($user) {
            return $user->makeVisible(['pin'])->append('has_pin');
        });

        return Inertia::render('users', [
            'users' => $users,
            'filters' => $request->only(['search', 'per_page']),
        ]);
    }

    /**
     * Store a newly created user.
     */
    public function store(StoreUserRequest $request): RedirectResponse
    {
        $this->authorizeAdmin($request);

        $data = $request->validated();
        $data['password'] = Hash::make($data['password']);
        $data['is_active'] = (bool) ($data['is_active'] ?? true);
        
        if (!empty($data['pin'])) {
            $data['pin'] = Hash::make($data['pin']);
        }

        User::create($data);

        return redirect()->back()->with('success', 'User created successfully.');
    }

    /**
     * Display the specified user.
     */
    public function show(Request $request, User $user): Response
    {
        $this->authorizeAdmin($request);

        // Make PIN visible (it will be hashed) and append has_pin accessor
        return Inertia::render('users/show', [
            'user' => $user->makeVisible(['pin'])->append('has_pin'),
        ]);
    }

    /**
     * Update the specified user.
     */
    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $this->authorizeAdmin($request);

        $data = $request->validated();

        // Only hash and update password if provided
        if (!empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        // Only hash and update PIN if provided
        if (!empty($data['pin'])) {
            $data['pin'] = Hash::make($data['pin']);
        } else {
            unset($data['pin']);
        }

        // Remove password_confirmation from data
        unset($data['password_confirmation']);

        if (array_key_exists('is_active', $data)) {
            $data['is_active'] = (bool) $data['is_active'];
        }

        $user->update($data);

        return redirect()->back()->with('success', 'User updated successfully.');
    }

    /**
     * Toggle user active status.
     */
    public function toggleActive(Request $request, User $user): RedirectResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'is_active' => ['nullable', 'boolean'],
        ]);

        $isActive = $request->has('is_active')
            ? $request->boolean('is_active')
            : !(bool) $user->is_active;

        $user->update([
            'is_active' => $isActive,
        ]);

        return redirect()->back()->with(
            'success',
            $isActive ? 'User activated successfully.' : 'User deactivated successfully.',
        );
    }

    /**
     * Remove the specified user.
     */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->authorizeAdmin($request);

        $user->delete();

        return redirect()->back()->with('success', 'User deleted successfully.');
    }
}
