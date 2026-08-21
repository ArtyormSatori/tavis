import { describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import type { FieldRequirement } from '../../types/channels';
import { renderWithProviders } from '../../test/test-utils';
import ChannelFieldInput from './ChannelFieldInput';

const textField: FieldRequirement = {
  key: 'api_key', label: 'API Key', field_type: 'string', required: true, placeholder: 'sk-...',
};

describe('probe', () => {
  it('raw dispatch is swallowed by the React value tracker', () => {
    const onChange = vi.fn();
    const { getByLabelText } = renderWithProviders(
      <ChannelFieldInput field={textField} value="" onChange={onChange} />
    );
    const input = getByLabelText(/API Key/) as HTMLInputElement;
    input.value = 'secret-value';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect({ rawDispatchCalls: onChange.mock.calls.length }).toEqual({ rawDispatchCalls: -1 });
  });

  it('fireEvent.change bypasses the tracker', () => {
    const onChange = vi.fn();
    const { getByLabelText } = renderWithProviders(
      <ChannelFieldInput field={textField} value="" onChange={onChange} />
    );
    const input = getByLabelText(/API Key/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'secret-value' } });
    expect({ fireEventChangeCalls: onChange.mock.calls }).toEqual({ fireEventChangeCalls: 'SENTINEL' });
  });
});
