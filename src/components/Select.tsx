import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  /** 触发器的无障碍名称；外层可见 label 结构由调用方保留 */
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  /** value 为空串时展示的占位文案，用于"选择后执行动作"型选择器 */
  placeholder?: string;
  disabled?: boolean;
}

export function Select({ label, value, options, onChange, placeholder, disabled }: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
      <RadixSelect.Trigger className="select-trigger" aria-label={label}>
        <span className="select-value"><RadixSelect.Value placeholder={placeholder} /></span>
        <RadixSelect.Icon className="select-chevron"><ChevronDown size={13} /></RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="select-content" position="popper" sideOffset={5}>
          <RadixSelect.Viewport className="select-viewport">
            {options.map((option) => (
              <RadixSelect.Item key={option.value} value={option.value} className="select-item">
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="select-item-check"><Check size={13} /></RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
