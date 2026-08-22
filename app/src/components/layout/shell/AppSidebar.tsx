import debugFactory from 'debug';
import { useEffect } from 'react';
import { LuPanelLeftOpen } from 'react-icons/lu';
import { useLocation, useNavigate } from 'react-router-dom';

import { useT } from '../../../lib/i18n/I18nContext';
import { useCoreState } from '../../../providers/CoreStateProvider';
import { trackEvent } from '../../../services/analytics';
import { normalizeAnalyticsPagePath } from '../../../services/analyticsRoutes';
import { APP_VERSION } from '../../../utils/config';
import { isLocalSessionToken } from '../../../utils/localSession';
import ConnectionIndicator from '../../ConnectionIndicator';
import {
  SidebarContent as SidebarScrollRegion,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuIcon,
  SidebarMenuItem,
  SidebarMenuLabel,
  SidebarTrigger,
  Tooltip,
  useSidebar,
} from '../../ui';
import CollapsedNavRail from './CollapsedNavRail';
import { NavIcon } from './navIcons';
import SidebarHeader from './SidebarHeader';
import SidebarNav from './SidebarNav';
import { SidebarSlotOutlet } from './SidebarSlot';

const log = debugFactory('sidebar');

interface FooterNavButtonProps {
  /** `NavTab.id`-style icon key resolved by {@link NavIcon}. */
  iconId: string;
  /** Already-translated label (also used as the `title`). */
  label: string;
  /** Whether the current route matches this entry. */
  active: boolean;
  /** `data-walkthrough` attribute for the walkthrough tour. */
  walkthroughAttr: string;
  onClick: () => void;
}

/**
 * Slim footer affordance row shared by the Rewards and Feedback entries. Kept
 * thin and low-profile so it reads as a footer entry, not a primary nav tab —
 * hence the tighter `sm` footprint and 13px type over {@link SidebarNav}'s rows.
 */
function FooterNavButton({
  iconId,
  label,
  active,
  walkthroughAttr,
  onClick,
}: FooterNavButtonProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size="sm"
        isActive={active}
        data-walkthrough={walkthroughAttr}
        onClick={onClick}
        title={label}
        className="h-auto gap-2.5 px-2.5 py-1.5 text-[13px]">
        <SidebarMenuIcon>
          <NavIcon id={iconId} className="h-4 w-4" />
        </SidebarMenuIcon>
        <SidebarMenuLabel>{label}</SidebarMenuLabel>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * The root-shell sidebar. Mounted as the sole child of `RootShellLayout`'s
 * `<Sidebar collapsible="icon">` column, so it renders one of two bodies
 * depending on that primitive's own `useSidebar()` state — the column itself
 * never unmounts, only narrows, so this component is what actually decides
 * what the collapsed state looks like:
 *
 * **Expanded**, split top-to-bottom:
 *
 *   ┌──────────────┐
 *   │ SidebarHeader │  utility row (collapse / settings / language)
 *   ├──────────────┤
 *   │ SidebarNav    │  static primary navigation
 *   │ SidebarSlot   │  dynamic, per-route content (scrolls)
 *   │  (Outlet)     │
 *   ├──────────────┤
 *   │ Rewards/Fdbk  │  account affordances
 *   ├──────────────┤
 *   │ beta footer   │  app-wide build/version line
 *   └──────────────┘
 *
 * Pages project content into the slot region with {@link SidebarContent}.
 * Background matches the previous in-page sidebar pane (white / neutral-900).
 *
 * **Collapsed**: a draggable strip (clears the macOS traffic lights), a
 * reopen trigger, and {@link CollapsedNavRail}'s icon-only nav — formerly a
 * sibling `<div>` rendered by `RootShellLayout` outside the (unmounted)
 * `Sidebar` column; now the column's own body while narrow. See
 * `RootShellLayout`'s `collapsible="icon"` comment for why that's safe.
 */
export default function AppSidebar() {
  const { t } = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const { state: sidebarState } = useSidebar();
  const collapsed = sidebarState === 'collapsed';
  const { snapshot: coreSnapshot, isReady } = useCoreState();
  // Rewards is a cloud-only surface (credits/referrals/coupons live behind the
  // backend rewards API); the page itself renders an "unavailable" state for
  // local sessions, so there's no point offering the entry there. Mirrors the
  // `cloudOnly` intent recorded for rewards in navConfig's AVATAR_MENU_ITEMS.
  //
  // Show it only once core state has bootstrapped to a real, non-local session.
  // The initial snapshot is `{ isReady: false, sessionToken: null }`, and
  // `isLocalSessionToken(null)` is `false`, so gating on the token alone would
  // briefly flash Rewards for a local session until the first refresh resolves.
  const showRewards =
    isReady &&
    Boolean(coreSnapshot.sessionToken) &&
    !isLocalSessionToken(coreSnapshot.sessionToken);
  const feedbackActive = location.pathname === '/feedback';
  const rewardsActive = location.pathname === '/rewards';

  // Log the gate outcome whenever it resolves/flips. Booleans only — never the
  // session token or a raw path.
  useEffect(() => {
    log(
      'rewards footer entry visibility resolved: visible=%s isReady=%s hasSession=%s local=%s',
      showRewards,
      isReady,
      Boolean(coreSnapshot.sessionToken),
      isLocalSessionToken(coreSnapshot.sessionToken)
    );
  }, [showRewards, isReady, coreSnapshot.sessionToken]);

  const handleFooterNav = (tab: string, path: string, active: boolean) => {
    log('footer nav click: tab=%s active=%s', tab, active);
    if (!active) {
      trackEvent('tab_bar_change', {
        from_tab: 'unknown',
        to_tab: tab,
        // Normalize to a route template so route-scoped entity IDs (thread,
        // flow, team, …) never leave the app via analytics.
        from_path: normalizeAnalyticsPagePath(location.pathname),
        to_path: path,
      });
    }
    navigate(path);
  };

  return (
    // Sits directly on the window chrome with no fill of its own, so the
    // sidebar and the frame around the content card are one continuous surface.
    // The legibility scrim lives on the shell root ({@link RootShellLayout}) and
    // deliberately NOT here — scrimming only this column would tint it
    // differently from the chrome beside the card, which is the seam the
    // two-layer look exists to remove. Regions below are separated by spacing
    // alone; the hairline seams the old opaque panel needed would draw lines
    // across the chrome.
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0" data-tauri-drag-region>
        <SidebarHeader />
      </div>
      <div className="flex-shrink-0">
        <SidebarNav />
      </div>
      <SidebarScrollRegion className="gap-0">
        {/* Flex column so routes that project more than one region can order
            them via Tailwind `order-*`. */}
        <SidebarSlotOutlet className="flex h-full flex-col" />
      </SidebarScrollRegion>
      <SidebarFooter>
        {/* Slim account affordances pinned above the status bar — Rewards then
            Feedback. Rewards is shown only for a resolved cloud session. */}
        <SidebarMenu>
          {showRewards && (
            <FooterNavButton
              iconId="rewards"
              label={t('nav.rewards')}
              active={rewardsActive}
              walkthroughAttr="tab-rewards"
              onClick={() => handleFooterNav('rewards', '/rewards', rewardsActive)}
            />
          )}
          <FooterNavButton
            iconId="feedback"
            label={t('nav.feedback')}
            active={feedbackActive}
            walkthroughAttr="tab-feedback"
            onClick={() => handleFooterNav('feedback', '/feedback', feedbackActive)}
          />
        </SidebarMenu>
        {/* App-wide footer: connectivity status + build/version, pinned to the
            bottom of the sidebar. */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-1 pt-2">
          <ConnectionIndicator />
          &middot;
          <span className="text-[10px] text-content-faint">
            {t('settings.betaBuild').replace('{version}', APP_VERSION)}
          </span>
        </div>
      </SidebarFooter>
    </div>
  );
}
