import { type KeyboardEvent, type MutableRefObject } from 'react';

import { useT } from '../../../lib/i18n/I18nContext';
import Button from '../../ui/Button';
import { CheckIcon } from '../../ui/icons';
import TextField from '../../ui/TextField';

const BIP39_IMPORT_LENGTHS = [12, 15, 18, 21, 24] as const;

export interface RecoveryPhraseImportModeProps {
  importWords: string[];
  selectedWordCount: number;
  importValid: boolean | null;
  inputRefs: MutableRefObject<(HTMLInputElement | null)[]>;
  onWordCountChange: (count: number) => void;
  onWordChange: (index: number, value: string) => void;
  onWordKeyDown: (index: number, e: KeyboardEvent<HTMLInputElement>) => void;
  onSwitchToGenerate: () => void;
}

/**
 * Import-mode body: word-count selector, the labelled word-slot grid, the
 * valid-phrase banner, and the link back to generate mode.
 */
const RecoveryPhraseImportMode = ({
  importWords,
  selectedWordCount,
  importValid,
  inputRefs,
  onWordCountChange,
  onWordChange,
  onWordKeyDown,
  onSwitchToGenerate,
}: RecoveryPhraseImportModeProps) => {
  const { t } = useT();

  return (
    <>
      <div className="mb-4">
        <p className="text-sm text-content-secondary leading-relaxed">
          {t('mnemonic.enterPhraseToRestore')}
        </p>
      </div>

      <ToggleGroupRoot
        type="single"
        variant="secondary"
        size="xs"
        value={String(selectedWordCount)}
        onValueChange={next => {
          if (next) onWordCountChange(Number(next));
        }}
        aria-label={t('mnemonic.words')}
        className="flex items-center gap-2 mb-3">
        <span className="text-xs text-content-muted">{t('mnemonic.words')}:</span>
        {BIP39_IMPORT_LENGTHS.map(len => (
          <ToggleGroupItem
            key={len}
            value={String(len)}
            className="rounded-lg data-[state=on]:bg-primary-500/20 data-[state=on]:border-primary-500/40 data-[state=on]:text-primary-600 dark:data-[state=on]:text-primary-300">
            {len}
          </ToggleGroupItem>
        ))}
      </ToggleGroupRoot>

      <div className="bg-surface-muted rounded-2xl p-4 mb-4 border border-line">
        <div className="grid grid-cols-3 gap-2">
          {importWords.map((word, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span className="text-content-muted font-mono text-xs w-5 text-right shrink-0">
                {index + 1}.
              </span>
              <TextField
                mono
                inputSize="sm"
                aria-label={`Recovery phrase word ${index + 1}`}
                ref={el => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                value={word}
                onChange={e => onWordChange(index, e.target.value)}
                onKeyDown={e => onWordKeyDown(index, e)}
                autoComplete="off"
                spellCheck={false}
                invalid={importValid === false && word.trim().length > 0}
                className={
                  importValid === true
                    ? '!border-sage-400 focus:!border-sage-300 dark:!border-sage-500/40'
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      </div>

      {importValid === true && (
        <div className="flex items-center gap-2 text-sage-400 text-sm mb-3 justify-center">
          <CheckIcon className="w-4 h-4" />
          <span>{t('mnemonic.validPhrase')}</span>
        </div>
      )}

      <Button type="button" variant="tertiary" onClick={onSwitchToGenerate} className="w-full mb-3">
        {t('mnemonic.generateNewPhrase')}
      </Button>
    </>
  );
};

export default RecoveryPhraseImportMode;
