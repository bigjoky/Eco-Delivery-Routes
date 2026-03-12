<?php

namespace App\Http\Requests\Users;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $userId = (string) $this->route('id');

        return [
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:180', 'unique:users,email,' . $userId . ',id'],
            'status' => ['sometimes', 'in:pending,active,suspended'],
            'password' => ['sometimes', 'string', 'min:8'],
        ];
    }
}
