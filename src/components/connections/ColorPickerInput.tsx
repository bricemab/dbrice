import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ColorPickerInputProps {
  value: string;
  onChange: (color: string) => void;
}

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#3b82f6", "#0ea5e9",
];

export function ColorPickerInput({ value, onChange }: ColorPickerInputProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent transition-colors"
        >
          <div
            className="h-4 w-4 rounded-full border border-black/10"
            style={{ backgroundColor: value || "#6366f1" }}
          />
          <span className="font-mono text-xs text-muted-foreground">{value || "#6366f1"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <HexColorPicker color={value || "#6366f1"} onChange={onChange} />
        <div className="mt-3 grid grid-cols-6 gap-1.5">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: color,
                borderColor: value === color ? "white" : "transparent",
                boxShadow: value === color ? "0 0 0 2px " + color : "none",
              }}
              onClick={() => onChange(color)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
