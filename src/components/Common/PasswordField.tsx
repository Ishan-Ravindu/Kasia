import clsx from "clsx";
import { ChangeEventHandler, forwardRef, type FC } from "react";

export interface PasswordFieldProps {
  /**
   * default is "password"
   */
  id?: string;
  /**
   * default is "password"
   */
  name?: string;
  /**
   * default is "Enter your password"
   */
  placeholder?: string;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  hasError?: boolean;
  disabled?: boolean;
  required?: boolean;
  /**
   * If not present, no label added to DOM
   */
  label?: string;

  classInput?: string;
  classLabel?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  (props, ref) => {
    return (
      <>
        {props.label ? (
          <label
            htmlFor={props.id ?? "password"}
            className={clsx(props.classLabel)}
          >
            {props.label}
          </label>
        ) : null}
        <input
          id={props.id ?? "password"}
          name={props.name ?? "password"}
          autoComplete="current-password"
          ref={ref}
          type="password"
          placeholder={props.placeholder ?? "Enter your password"}
          onChange={props.onChange}
          className={clsx(props.classInput, {
            "!border-red-500": props.hasError,
          })}
          disabled={props.disabled}
          required={props.required}
          value={props.value}
        />
      </>
    );
  }
);
