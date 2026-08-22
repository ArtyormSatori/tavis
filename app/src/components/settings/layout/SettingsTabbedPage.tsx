import type { ReactNode } from 'react';

import ChipTabs, { type ChipTabItem } from '../../layout/ChipTabs';

export interface SettingsTabbedPageProps<T extends string> {
  title: ReactNode;
  description?: ReactNode;
  tabs?: ChipTabItem<T>[];
  value?: T;
  onChange?: (value: T) => void;
  tabsAriaLabel?: string;
  tabsTestIdPrefix?: string;
  children: ReactNode;
}

/**
 * Reusable settings-detail shell for a titled page with sibling chip views.
 *
 * The two-pane Settings navigation replaced breadcrumb trails, so this
 * primitive deliberately keeps page navigation to the title, description, and
 * local chip row. Its child owns the active view and its scrolling behavior.
 */
export default function SettingsTabbedPage<T extends string>({
  title,
  description,
  tabs,
  value,
  onChange,
  tabsAriaLabel,
  tabsTestIdPrefix,
  children,
}: SettingsTabbedPageProps<T>) {
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 pb-4">
        <header className="space-y-0.5">
          <h1 className="text-2xl font-semibold tracking-tight text-content">{title}</h1>
          {description != null && <p className="text-sm text-content-muted">{description}</p>}
        </header>
        {tabs && tabs.length > 0 && value != null && onChange && tabsAriaLabel ? (
          <ChipTabs
            className="flex flex-wrap gap-1.5"
            ariaLabel={tabsAriaLabel}
            testIdPrefix={tabsTestIdPrefix}
            items={tabs}
            value={value}
            onChange={onChange}
          />
        ) : null}
      </div>
      <div aria-hidden className="-mx-4 border-t border-line" />
      <div className="min-h-0 flex-1 overflow-hidden pt-4">{children}</div>
    </div>
  );
}
