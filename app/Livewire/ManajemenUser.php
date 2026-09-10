<?php

namespace App\Livewire;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.app')]
class ManajemenUser extends Component
{
    public $name = '';
    public $email = '';
    public $password = '';
    public $role = 'sales';

    protected $rules = [
        'name' => 'required|min:3',
        'email' => 'required|email|unique:users,email',
        'password' => 'required|min:8',
        'role' => 'required|in:admin,sales,finance',
    ];

    public function simpan()
    {
        $this->validate();

        User::create([
            'name' => $this->name,
            'email' => $this->email,
            'password' => Hash::make($this->password),
            'role' => $this->role,
            'is_active' => true,
        ]);

        $this->reset(['name', 'email', 'password', 'role']);
        session()->flash('message', 'User baru berhasil ditambahkan.');
    }

    public function ubahStatus(User $user)
    {
        $user->is_active = ! $user->is_active;
        $user->save();
    }

    public function render()
    {
        return view('livewire.manajemen-user', [
            'users' => User::orderBy('name')->get(),
        ]);
    }
}