import { useState } from 'react';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DialogContent,
  DialogRoot,
  DialogTitle,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  Input,
  Label,
  ListRow,
  NativeSelect,
  NumberField,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
  Progress,
  Separator,
  SheetContent,
  SheetRoot,
  SheetTitle,
  SheetTrigger,
  StatusLine,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
  TextArea,
  TextField,
  Tooltip,
} from '../../components/ui';

/**
 * Dev-only gallery of every shared UI primitive, reachable at `#/dev/ui`.
 *
 * Three jobs, only the first of which is obvious:
 *  1. a visual review surface for the primitive layer, in whichever theme the
 *     app is currently set to — switch themes in Settings and reload here;
 *  2. it *imports* every primitive, so `knip` does not report the new exports
 *     as unused during the window where feature code has not adopted them yet;
 *  3. somewhere for the a11y smoke lane to grow against real controls.
 *
 * Not linked from any nav. `src/pages/dev/**` is coverage-excluded by design.
 */
const BUTTON_VARIANTS = ['primary', 'secondary', 'tertiary'] as const;
const BUTTON_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
const BADGE_VARIANTS = ['neutral', 'primary', 'success', 'warning', 'danger'] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-content">{title}</h2>
      <Card>
        <div className="space-y-4 p-4">{children}</div>
      </Card>
    </section>
  );
}

export default function UiGallery() {
  const [checked, setChecked] = useState(true);
  const [indeterminate, setIndeterminate] = useState(true);
  const [switched, setSwitched] = useState(true);
  const [numeric, setNumeric] = useState('30');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-content">UI primitives</h1>
        <p className="text-sm text-content-muted">
          Every shared primitive, in the active theme. Radix supplies behaviour; the styling is this
          app&apos;s semantic tokens, so each control follows a custom theme.
        </p>
      </header>

      <Section title="Button — variant x tone">
        {BUTTON_VARIANTS.map(variant => (
          <div key={variant} className="flex flex-wrap items-center gap-2">
            <span className="w-20 text-xs text-content-muted">{variant}</span>
            <Button variant={variant}>Default</Button>
            <Button variant={variant} tone="danger">
              Danger
            </Button>
            <Button variant={variant} disabled>
              Disabled
            </Button>
          </div>
        ))}
        <Separator />
        <div className="flex flex-wrap items-center gap-2">
          {BUTTON_SIZES.map(size => (
            <Button key={size} size={size}>
              {size}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {BUTTON_SIZES.map(size => (
            <Button key={size} size={size} iconOnly aria-label={`icon ${size}`} variant="secondary">
              +
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Badge">
        <div className="flex flex-wrap items-center gap-2">
          {BADGE_VARIANTS.map(variant => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="Form controls">
        <Field
          htmlFor="gallery-text"
          label="Text field"
          description="A labelled row."
          control={<TextField id="gallery-text" placeholder="Placeholder" />}
        />
        <Field
          htmlFor="gallery-mono"
          label="Monospace"
          control={<TextField id="gallery-mono" mono defaultValue="sk-abc123" />}
        />
        <Field
          htmlFor="gallery-invalid"
          label="Invalid"
          control={<Input id="gallery-invalid" invalid defaultValue="nope" />}
        />
        <Field
          htmlFor="gallery-area"
          label="Text area"
          stacked
          control={<TextArea id="gallery-area" rows={3} placeholder="Longer text" />}
        />
        <Field
          htmlFor="gallery-select"
          label="Native select"
          control={
            <NativeSelect id="gallery-select" defaultValue="b">
              <option value="a">Alpha</option>
              <option value="b">Beta</option>
            </NativeSelect>
          }
        />
        <Field
          htmlFor="gallery-switch"
          label="Switch"
          control={<Switch id="gallery-switch" checked={switched} onCheckedChange={setSwitched} />}
        />
        <Field
          htmlFor="gallery-check"
          label="Checkbox"
          control={
            <div className="flex items-center gap-3">
              <Checkbox
                id="gallery-check"
                checked={checked}
                onCheckedChange={setChecked}
                aria-label="Checkbox"
              />
              <Checkbox
                checked={false}
                indeterminate={indeterminate}
                onCheckedChange={() => setIndeterminate(false)}
                aria-label="Indeterminate"
              />
            </div>
          }
        />
        <Field
          htmlFor="gallery-number"
          label="Number field"
          control={
            <NumberField
              id="gallery-number"
              value={numeric}
              onChange={setNumeric}
              onCommit={() => {}}
              unit="seconds"
              min={1}
              max={120}
              aria-label="Timeout"
            />
          }
        />
        <Field label="Disabled row" disabled control={<Label>Not interactive</Label>} />
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Button variant="secondary" tone="danger" onClick={() => setConfirmOpen(true)}>
            Open confirm
          </Button>

          <SheetRoot>
            <SheetTrigger asChild>
              <Button variant="secondary">Open sheet</Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-5">
              <SheetTitle className="text-sm font-semibold text-content">Sheet</SheetTitle>
              <p className="mt-2 text-sm text-content-muted">Anchored to an edge, focus trapped.</p>
            </SheetContent>
          </SheetRoot>

          <PopoverRoot>
            <PopoverTrigger asChild>
              <Button variant="tertiary">Popover</Button>
            </PopoverTrigger>
            <PopoverContent>Anchored, dismissable, collision-aware.</PopoverContent>
          </PopoverRoot>

          <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
              <Button variant="tertiary">Menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Rename</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem disabled>Disabled</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuRoot>

          <Tooltip label="A tooltip">
            <Button variant="tertiary">Hover me</Button>
          </Tooltip>
        </div>

        {dialogOpen && (
          <DialogRoot open onOpenChange={next => !next && setDialogOpen(false)}>
            <DialogContent className="p-5">
              <DialogTitle className="text-sm font-semibold text-content">Dialog</DialogTitle>
              <p className="mt-2 text-sm text-content-muted">
                Escape, outside click and focus trap all come from Radix.
              </p>
              <div className="mt-4 flex justify-end">
                <Button size="sm" onClick={() => setDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </DialogContent>
          </DialogRoot>
        )}

        {confirmOpen && (
          <ConfirmDialog
            title="Delete this?"
            body="Labels default through i18n, so this reads in the active locale."
            destructive
            onConfirm={() => setConfirmOpen(false)}
            onCancel={() => setConfirmOpen(false)}
          />
        )}
      </Section>

      <Section title="Tabs">
        <TabsRoot defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">Overview</TabsTrigger>
            <TabsTrigger value="two">Activity</TabsTrigger>
            <TabsTrigger value="three">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="one" className="pt-3 text-sm text-content-muted">
            Arrow keys move between tabs; only one tab is a tab stop.
          </TabsContent>
          <TabsContent value="two" className="pt-3 text-sm text-content-muted">
            Activity panel.
          </TabsContent>
          <TabsContent value="three" className="pt-3 text-sm text-content-muted">
            Settings panel.
          </TabsContent>
        </TabsRoot>
      </Section>

      <Section title="Data">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Nightly sync</TableCell>
              <TableCell>
                <Badge variant="success">Healthy</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Index rebuild</TableCell>
              <TableCell>
                <Badge variant="warning">Degraded</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Separator />
        <ul className="rounded-lg border border-line">
          <ListRow label="allow-list-entry.example.com" removeLabel="Remove" onRemove={() => {}} />
          <ListRow
            label="/usr/local/bin/tool"
            mono
            removeLabel="Remove"
            badge={<Badge variant="neutral">path</Badge>}
            onRemove={() => {}}
          />
        </ul>
        <EmptyState label="Nothing here yet." />
      </Section>

      <Section title="Feedback">
        <Progress value={42} aria-label="Progress" />
        <StatusLine saving={false} savedNote="Saved" savingLabel="Saving…" />
        <StatusLine saving savingLabel="Saving…" />
        <StatusLine saving={false} error="Could not reach the server." savingLabel="Saving…" />
      </Section>
    </div>
  );
}
