/*
 * One titled group of workload rows (chat, or background) rendered as a real
 * table.
 *
 * The two groups were byte-identical markup differing only in copy and row
 * array, so they share one component. `Table` brings the piece that matters
 * beyond semantics: it wraps the table in its own `overflow-x-auto`, so a
 * narrow settings pane scrolls the matrix rather than the whole page.
 *
 * The action column has a deliberately empty header. It holds a control, not
 * data, and a visible label for it would be read out on every row; the buttons
 * name themselves ("Change Model" / "Choose Model").
 */
import { type ReactNode } from 'react';

import { useT } from '../../../../lib/i18n/I18nContext';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '../../../ui/Table';

export const WorkloadTable = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => {
  const { t } = useT();
  return (
    <div className="flex w-full flex-col">
      <div className="flex flex-col gap-0.5 px-4 pb-1 pt-4">
        <h4 className="text-sm font-semibold text-content">{title}</h4>
        <p className="text-xs text-content-muted">{description}</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t('settings.ai.workload.columnHeader')}</TableHead>
            <TableHead>{t('settings.ai.providerLabel')}</TableHead>
            <TableHead>{t('settings.ai.modelLabel')}</TableHead>
            <TableHead className="w-px" />
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
};

export default WorkloadTable;
