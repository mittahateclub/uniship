'use client';

import type { Icon, IconProps, IconWeight } from '@phosphor-icons/react';

type LucideLikeProps = Omit<IconProps, 'weight'> & { strokeWidth?: number | string; weight?: IconWeight };

export function smooth(Glyph: Icon, weight: IconWeight = 'fill') {
  function SmoothIcon({ strokeWidth: ignored, ...props }: LucideLikeProps) {
    void ignored;
    return <Glyph weight={weight} {...props} />;
  }
  return SmoothIcon;
}
