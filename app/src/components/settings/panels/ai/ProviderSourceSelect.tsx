import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from '../../../ui';
import type { CloudProvider, CustomDialogSource } from './aiPanelTypes';

interface ProviderSourceSelectProps {
  source: CustomDialogSource | null;
  cloudProviders: CloudProvider[];
  localAvailable: boolean;
  localLabel: string;
  claudeCodeEnabled: boolean;
  claudeCodeLabel: string;
  ariaLabel: string;
  onChange: (source: CustomDialogSource) => void;
}

const encodeSource = (source: CustomDialogSource) =>
  source.kind === 'cloud' ? `cloud:${source.providerSlug}` : source.kind;

/**
 * Short, shared provider-source picker for routing forms. Cloud, local, and
 * Claude Code sources carry different routing shapes, but expose one Select
 * primitive to the user and one typed value to the caller.
 */
export function ProviderSourceSelect({
  source,
  cloudProviders,
  localAvailable,
  localLabel,
  claudeCodeEnabled,
  claudeCodeLabel,
  ariaLabel,
  onChange,
}: ProviderSourceSelectProps) {
  const claudeCodeVisible = claudeCodeEnabled || source?.kind === 'claude-code';

  return (
    <SelectRoot
      value={source ? encodeSource(source) : undefined}
      onValueChange={value => {
        if (value === 'local') onChange({ kind: 'local' });
        else if (value === 'claude-code') onChange({ kind: 'claude-code' });
        else if (value.startsWith('cloud:')) {
          onChange({ kind: 'cloud', providerSlug: value.slice('cloud:'.length) });
        }
      }}>
      <SelectTrigger aria-label={ariaLabel} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {cloudProviders.map(provider => (
          <SelectItem key={provider.slug} value={`cloud:${provider.slug}`}>
            {provider.label}
          </SelectItem>
        ))}
        {localAvailable && <SelectItem value="local">{localLabel}</SelectItem>}
        {claudeCodeVisible && <SelectItem value="claude-code">{claudeCodeLabel}</SelectItem>}
      </SelectContent>
    </SelectRoot>
  );
}

export default ProviderSourceSelect;
