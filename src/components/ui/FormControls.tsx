import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export const TextInput = ({ label, value, onChange, className = '', type = 'text', ...props }: TextInputProps) => (
  <label className={`pm-field ${className}`}>
    <span className="pm-field__label">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="pm-input"
      {...props}
    />
  </label>
);

interface SelectInputProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

export const SelectInput = ({ label, value, options, onChange, className = '', ...props }: SelectInputProps) => (
  <label className={`pm-field ${className}`}>
    <span className="pm-field__label">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="pm-select"
      {...props}
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

interface TextareaInputProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export const TextareaInput = ({ label, value, onChange, className = '', rows = 3, ...props }: TextareaInputProps) => (
  <label className={`pm-field ${className}`}>
    <span className="pm-field__label">{label}</span>
    <textarea
      value={value}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
      className="pm-textarea"
      {...props}
    />
  </label>
);
