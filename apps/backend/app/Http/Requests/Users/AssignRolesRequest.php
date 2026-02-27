<?php

namespace App\Http\Requests\Users;

use Illuminate\Foundation\Http\FormRequest;

class AssignRolesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'role_ids' => ['required', 'array', 'min:1'],
            'role_ids.*' => ['uuid'],
        ];
    }
}
