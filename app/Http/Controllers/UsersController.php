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
    /**
     * Display a listing of users.
     */
    public function index(Request $request): Response
    {
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
        $data = $request->validated();
        $data['password'] = Hash::make($data['password']);
        
        if (!empty($data['pin'])) {
            $data['pin'] = Hash::make($data['pin']);
        }

        User::create($data);

        return redirect()->back()->with('success', 'User created successfully.');
    }

    /**
     * Display the specified user.
     */
    public function show(User $user): Response
    {
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

        $user->update($data);

        return redirect()->back()->with('success', 'User updated successfully.');
    }

    /**
     * Remove the specified user.
     */
    public function destroy(User $user): RedirectResponse
    {
        $user->delete();

        return redirect()->back()->with('success', 'User deleted successfully.');
    }
}
