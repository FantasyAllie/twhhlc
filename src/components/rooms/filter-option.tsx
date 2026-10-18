import { Button } from "@/components/ui/button";

export function FilterOption({ checked, onCheckedChange, children }: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={checked ? "default" : "outline"}
      data-ios-glass
      aria-pressed={checked}
      onClick={() => onCheckedChange(!checked)}
      className="h-auto min-h-11 w-full justify-start whitespace-normal px-3 py-2 text-left [&>span:first-child]:min-w-0 [&>span:last-child:not(:first-child)]:text-current [&>span:last-child:not(:first-child)]:opacity-70"
    >
      {children}
    </Button>
  );
}