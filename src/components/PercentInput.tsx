import React from 'react';
import DecimalInput, { DecimalFieldProps } from '@/components/DecimalInput';

/** Percent input: a `%`-suffixed decimal field (one decimal, 2 places, keep-whole-unless-cents).
 *  Numeric only — for rates like 6.50%. Intentionally uncapped: payday/predatory APRs exceed 100%. */
export default function PercentInput(props: DecimalFieldProps) {
  return <DecimalInput suffix="%" {...props} />;
}
