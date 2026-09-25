import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import type { ButtonHTMLAttributes } from "react";
export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button ${className}`} {...props} />;
}
export function Range({
  id,
  label,
  value,
  min = 0,
  max = 5,
  step = 1,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <Slider.Root
      className="slider"
      min={min}
      max={max}
      step={step}
      value={[value]}
      onValueChange={([v]) => onChange(v)}
    >
      <Slider.Track className="slider-track">
        <Slider.Range className="slider-range" />
      </Slider.Track>
      <Slider.Thumb id={id} aria-label={label} className="slider-thumb" />
    </Slider.Root>
  );
}
export function Toggle({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Switch.Root
      id={id}
      className="switch"
      checked={checked}
      onCheckedChange={onChange}
    >
      <Switch.Thumb className="switch-thumb" />
    </Switch.Root>
  );
}
