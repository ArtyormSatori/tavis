/**
 * The UI primitive layer — the only sanctioned import path for shared controls.
 *
 * This barrel previously omitted `Button` and `Input`, which is the likeliest
 * reason 491 raw `<button>` elements grew alongside 591 `<Button>` ones: the
 * barrel did not offer one. Everything is exported here now; if a primitive
 * exists, import it from `components/ui` rather than reaching into the file.
 */

// Actions
export { default as Button, buttonVariants, type ButtonProps } from './Button';

// Form controls
export { default as Input, type InputProps } from './Input';
export { default as TextField, type TextFieldProps } from './TextField';
export { default as TextArea, type TextAreaProps } from './TextArea';
export { default as NumberField, type NumberFieldProps } from './NumberField';
export { default as NativeSelect, type NativeSelectProps } from './NativeSelect';
export { default as Checkbox, type CheckboxProps } from './Checkbox';
export { default as Switch, type SwitchProps } from './Switch';
export { default as Label, type LabelProps } from './Label';
export { default as Field, type FieldProps } from './Field';

// Surfaces & content
export { default as Card, type CardProps } from './Card';
export { default as Badge, badgeVariants, type BadgeProps, type BadgeVariant } from './Badge';
export { default as Separator, type SeparatorProps } from './Separator';
export { default as EmptyState, type EmptyStateProps } from './EmptyState';
export { default as StatusLine, type StatusLineProps } from './StatusLine';
export { default as ListRow, type ListRowProps } from './ListRow';
export { default as Progress, type ProgressProps } from './Progress';
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './Table';

// Overlays
export {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  type DialogContentProps,
} from './Dialog';
export {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetRoot,
  SheetTitle,
  SheetTrigger,
  sheetVariants,
  type SheetContentProps,
} from './Sheet';
export {
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
  type PopoverContentProps,
} from './Popover';
export {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  type DropdownMenuContentProps,
} from './DropdownMenu';
export { TabsContent, TabsList, TabsRoot, TabsTrigger } from './Tabs';

export { default as Tooltip } from './Tooltip';
export { ModalShell, type ModalClosePolicy, type ModalShellProps } from './ModalShell';
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';

// Feedback & misc
export { Spinner, CheckIcon, CloseIcon, WarningIcon } from './icons';
export { CenteredLoadingState, ErrorBanner, InlineLoadingStatus } from './LoadingState';
export { default as BetaBanner } from './BetaBanner';
