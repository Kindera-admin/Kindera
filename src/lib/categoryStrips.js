// Gradient strips across the top of dashboard shortcut cards: one hue per
// card category (see DESIGN.md, "Dashboard category strips"). Kept as full
// class strings so Tailwind can see them.
export const CATEGORY_STRIPS = {
  brand: 'from-brand to-brand-accent',
  dataBlue: 'from-data-blue to-blue-500',
  teal: 'from-teal-700 to-teal-600',
  cyan: 'from-cyan-700 to-cyan-600',
  blue: 'from-blue-500 to-blue-400',
  emerald: 'from-emerald-500 to-emerald-400',
  orange: 'from-orange-500 to-orange-400',
  amber: 'from-amber-500 to-amber-400',
  rose: 'from-rose-600 to-rose-400',
  slate: 'from-gray-600 to-gray-500',
};
