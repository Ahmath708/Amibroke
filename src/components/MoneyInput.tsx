import React from 'react';
import DecimalInput, { DecimalFieldProps } from '@/components/DecimalInput';

/** Currency input: a `$`-prefixed decimal field (one decimal, 2 places, keep-whole-unless-cents).
 *  The parent holds the raw string and parses it (parseFloat) on submit. */
export default function MoneyInput(props: DecimalFieldProps) {
  return <DecimalInput prefix="$" {...props} />;
}
