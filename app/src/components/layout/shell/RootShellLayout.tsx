import debugFactory from 'debug';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useT } from '../../../lib/i18n/I18nContext';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  ensurePanelLayout,
  selectPanelLayout,
  setSidebarVisible,
  setSidebarWidth,
  toggleSidebar,
} from '../../../store/layoutSlice';
import {
  Sidebar,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SidebarProvider,
  SidebarRail,
} from '../../ui';
import ContentSurface from './ContentSurface';
import WindowDragBar from './WindowDragBar';

const log = debugFactory('sidebar');

// `app-shell` (not the older `root-shell`) so the persisted geometry seeds
// fresh with the sidebar visible by default. Exported so the global command
// layer (mod+B "Toggle sidebar") can target this exact panel.
export const APP_SHELL_LAYOUT_ID = 'app-shell';
const LAYOUT_ID = APP_SHELL_LAYOUT_ID;
// Geometry bounds come from the `Sidebar` primitive rather than being restated
// here — they were byte-identical, and two copies of a clamp is one copy too
// many once the primitive is the thing doing the clamping.
const LAYOUT_DEFAULTS = { sidebarVisible: true, sidebarWidth: SIDEBAR_DEFAULT_WIDTH };

function clamp(width: number): number {
  return Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);
}

/**
 * Subscribe to the root shell sidebar's visibility and get helpers to drive it
 * from chrome that lives elsewhere (e.g. the in-sidebar header's collapse
 * button, or a reshow button in the content area).
 */
export function useRootSidebar() {
  const dispatch = useAppDispatch();
  const layout = useAppSelector(selectPanelLayout(LAYOUT_ID, LAYOUT_DEFAULTS));
  return {
    visible: layout.sidebarVisible,
    toggle: useCallback(() => dispatch(toggleSidebar({ id: LAYOUT_ID })), [dispatch]),
    show: useCallback(
      () => dispatch(setSidebarVisible({ id: LAYOUT_ID, visible: true })),
      [dispatch]
    ),
    hide: useCallback(
      () => dispatch(setSidebarVisible({ id: LAYOUT_ID, visible: false })),
      [dispatch]
    ),
  };
}

interface RootShellLayoutProps {
  /** Always-visible left pane (the app sidebar). */
  sidebar: ReactNode;
  /** Dynamic main content (the routed page area). */
  children: ReactNode;
  /**
   * Render the content edge-to-edge instead of as an inset card. Forwarded to
   * {@link ContentSurface} — see its docs for the compositing constraint this
   * exists for, and why no route sets it today.
   */
  unframed?: boolean;
}

/**
 * Viewport-filling two-pane shell for the app root, built as two layers rather
 * than two opaque panes:
 *
 *   - **Chrome** — this component paints nothing of its own. The themed
 *     {@link AppBackground} behind it shows through here and behind the
 *     sidebar, so the frame carries the theme's hue as one continuous surface.
 *   - **Card** — the routed content sits on a single inset, rounded
 *     {@link ContentSurface}, the only opaque sheet in the shell.
 *
 * The two separate by fill contrast, which is why the sidebar needs no border
 * and the panes need no divider fill. The dragged sidebar width persists per
 * user via the `layout` slice (id `app-shell`).
 *
 * ## Redux stays the source of truth
 *
 * The column, the rail and the reopen affordance are the `Sidebar` primitive,
 * but the primitive is driven as a **controlled view**: `open` and `width` are
 * read out of the `layout` slice on every render, and `onOpenChange` /
 * `onWidthChange` dispatch back into it. Letting `SidebarProvider` hold the
 * state uncontrolled would look identical in a unit test and silently stop
 * restoring the persisted geometry across restarts.
 *
 * `keyboardShortcut` stays off (its default) for the same reason it always was:
 * `lib/commands/registry` already binds mod+B to `toggleSidebar`, and a second
 * window listener on the same chord toggles twice and cancels out.
 */
export default function RootShellLayout({ sidebar, children, unframed }: RootShellLayoutProps) {
  const { t } = useT();
  const dispatch = useAppDispatch();
  const layout = useAppSelector(selectPanelLayout(LAYOUT_ID, LAYOUT_DEFAULTS));
  const persistedWidth = clamp(layout.sidebarWidth);
  const isOpen = layout.sidebarVisible;

  // Seed persisted geometry once so the selector returns a stable stored
  // reference on subsequent renders (avoids the new-object memoization warning).
  useEffect(() => {
    dispatch(ensurePanelLayout({ id: LAYOUT_ID, defaults: LAYOUT_DEFAULTS }));
  }, [dispatch]);

  // Live drag width. `SidebarRail` reports a width per pointermove frame; those
  // frames are held locally and committed to Redux once on release, so a drag
  // writes (and persists) one value rather than sixty.
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const dragWidthRef = useRef<number | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const width = dragWidth ?? persistedWidth;

  const commitWidth = useCallback(
    (next: number) => dispatch(setSidebarWidth({ id: LAYOUT_ID, width: clamp(Math.round(next)) })),
    [dispatch]
  );

  /** Every width the primitive proposes — drag frames and arrow-key steps alike. */
  const handleWidthChange = useCallback(
    (next: number) => {
      if (draggingRef.current) {
        dragWidthRef.current = next;
        setDragWidth(next);
        return;
      }
      // Arrow-key resize: discrete, so it lands straight in the store.
      commitWidth(next);
    },
    [commitWidth]
  );

  const handleOpenChange = useCallback(
    (next: boolean) => dispatch(setSidebarVisible({ id: LAYOUT_ID, visible: next })),
    [dispatch]
  );

  // The rail owns the pointermove maths; this only brackets the gesture (and
  // paints the drag cursor across the whole window while it is in flight).
  const handleRailPointerDown = useCallback(() => {
    draggingRef.current = true;
    dragWidthRef.current = null;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function detach() {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
      draggingRef.current = false;
      dragCleanupRef.current = null;
    }
    function stop() {
      detach();
      const finalWidth = dragWidthRef.current;
      dragWidthRef.current = null;
      setDragWidth(null);
      if (finalWidth != null) commitWidth(finalWidth);
    }

    dragCleanupRef.current = detach;
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
  }, [commitWidth]);

  // Detach global listeners if we unmount mid-drag.
  useLayoutEffect(() => () => dragCleanupRef.current?.(), []);

  return (
    // The chrome layer. One legibility scrim across the WHOLE shell — the
    // sidebar column and the frame around the content card — so the two read as
    // a single continuous surface. Scrimming per-pane would tint them
    // differently and reintroduce the very seam this layout removes.
    //
    // The alpha is deliberately light: the themed AppBackground behind it is an
    // *animated* WebGL mesh gradient, and the content card above is opaque, so
    // the chrome is the only place that motion is visible at all. A heavier
    // scrim (or a backdrop blur, which also smears the 18px dotted canvas)
    // flattens it back into paint and leaves the shader burning GPU for nothing.
    // /30 is the legibility knob — raise it if sidebar labels wash out, which is
    // most likely under a `backdrop: image` theme rather than the mesh.
    <SidebarProvider
      open={isOpen}
      onOpenChange={handleOpenChange}
      width={width}
      onWidthChange={handleWidthChange}
      minWidth={SIDEBAR_MIN_WIDTH}
      maxWidth={SIDEBAR_MAX_WIDTH}
      className="bg-surface-chrome/30">
      {/* `collapsible="offcanvas"` unmounts the column when collapsed, which is
          exactly what the hand-rolled `{isOpen && …}` did — the native webview
          glued to the content bounds has historically punched through a
          zero-width-but-present column. */}
      <Sidebar collapsible="offcanvas" data-testid="root-shell-sidebar">
        {sidebar}
      </Sidebar>

      {/* Resize seam. Transparent at rest — the sidebar and the content card
          separate by fill contrast, so a filled seam would draw a line across
          the chrome that the two-layer look is trying to remove. Arrow keys
          resize in 16px steps; the pointer drag is bracketed above. */}
      {isOpen && (
        <SidebarRail
          aria-label={t('layout.resizeSidebar')}
          title={t('layout.resizeSidebar')}
          data-testid="root-shell-divider"
          data-analytics-id="root-shell-resize-divider"
          onPointerDown={handleRailPointerDown}
        />
      )}

      {/* Reshow affordance — only when the sidebar is collapsed. A thin rail
          that occupies layout space (NOT an overlay) so the content — and the
          native CEF webview glued to the content's bounds, which composites
          above the HTML layer — starts to its right and never covers it. */}
      {!isOpen && (
        <div className="flex w-14 flex-none flex-col items-center gap-0.5">
          {/* macOS overlay title bar (titleBarStyle: Overlay) floats the traffic
              lights over the top-left. The expanded SidebarHeader dodges them by
              right-aligning, but this narrow rail can't — so reserve a draggable
              strip the height of the window controls and start the rail below it,
              clear of the lights. */}
          <div className="h-7 w-full flex-none" data-tauri-drag-region />
          <Tooltip label={t('layout.showSidebar')}>
            {/* The primitive's own trigger, so reopening goes through the same
                controlled `onOpenChange` as every other visibility change. 32px
                square: no primitive size maps to that, so the footprint is
                overridden while the focus ring/transition come from the trigger. */}
            <SidebarTrigger
              data-testid="root-shell-reopen"
              data-analytics-id="root-shell-reopen-sidebar"
              aria-label={t('layout.showSidebar')}
              className="h-8 w-8 rounded-lg">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </SidebarTrigger>
          </Tooltip>
          {/* Keep the primary nav reachable while collapsed: an icon-only rail. */}
          <div className="mt-1 w-full pt-1">
            <CollapsedNavRail />
          </div>
        </div>
      )}

      <div
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
        data-testid="root-shell-content">
        {/* macOS overlay-title-bar band, in flow ABOVE the content card so the
            traffic lights land on bare chrome instead of on the card. No-op off
            macOS / outside Tauri, where the native title bar already owns that
            band and reserving one would just waste 28px. */}
        <WindowDragBar />
        <ContentSurface unframed={unframed}>{children}</ContentSurface>
      </div>
    </SidebarProvider>
  );
}
