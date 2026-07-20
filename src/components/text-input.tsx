"use client";

const inputClasses =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white placeholder-slate-500 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-500";

type TextInputProps = {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  error?: string;
};

export function TextInput({
  id,
  name,
  label,
  type = "text",
  placeholder,
  autoComplete,
  required,
  minLength,
  error,
}: TextInputProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-slate-300">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClasses}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
