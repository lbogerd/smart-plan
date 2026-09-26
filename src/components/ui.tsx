import { twMerge } from "tailwind-merge";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  className = "",
  variant = "outline",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "outline" | "primary" | "ghost";
}) {
  return (
    <button
      type={type}
      className={twMerge(
        `inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${variant === "primary" ? "bg-foreground text-white hover:bg-foreground/85" : variant === "ghost" ? "text-muted-foreground hover:bg-muted hover:text-foreground" : "border border-border bg-background shadow-xs hover:bg-muted"} `,
        className,
      )}
      {...props}
    />
  );
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
      className="inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-zinc-300 p-0.5 transition-colors data-[state=checked]:bg-accent"
      checked={checked}
      onCheckedChange={onChange}
    >
      <Switch.Thumb className="size-5 rounded-full bg-white shadow-xs transition-transform data-[state=checked]:translate-x-4" />
    </Switch.Root>
  );
}
export function Brand() {
  return (
    <a
      href="/"
      className="text-lg font-semibold tracking-[-0.05em] text-foreground"
    >
      smartplan<span className="text-accent">.</span>
    </a>
  );
}
export function Header({ children }: { children?: ReactNode }) {
  return (
    <header className="flex min-h-17 items-center justify-between gap-4 border-b border-border/70 px-6 sm:px-10">
      <Brand />
      <nav
        className="flex items-center gap-3 text-sm text-muted-foreground"
        aria-label="Main"
      >
        {children}
      </nav>
    </header>
  );
}
export const proseClass =
  "prose prose-zinc max-w-none [&>:first-child]:mt-0 text-[17px] leading-[1.8] sm:text-[18px] prose-headings:font-semibold prose-headings:tracking-[-0.035em] prose-headings:text-foreground prose-h1:text-4xl prose-h2:mt-11 prose-h2:mb-4 prose-h2:text-[26px] prose-h3:mt-7 prose-h3:mb-3 prose-h3:text-xl prose-p:my-5 prose-a:text-accent prose-a:decoration-accent/40 prose-a:underline-offset-4 prose-strong:font-semibold prose-strong:text-foreground prose-li:my-1.5 prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-muted-foreground prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:border prose-pre:border-border prose-pre:bg-muted prose-pre:text-foreground prose-hr:border-border prose-img:rounded-lg";
