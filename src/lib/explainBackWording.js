// What Explain it back asks, and when it shows up. All of it runs in the browser from values the page
// already has; nothing here is sent anywhere.

// Placeholders, not settled numbers.
export const MIN_UNITS_FOR_OPEN = 5;
export const STRONG_SHARE = 0.6;
export const WEAK_SHARE = 0.1;
export const MIN_READ_MS = 45000;
// The block appears once the end of the document is within this many screens below the bottom of the window.
export const REVEAL_SCREENS = 0.9;

// estimates: the labelled entries from the server's learner estimates for this reading ([] when learning
// memory is off or nothing is known). Returns 'open' only when there is evidence the reader understood a lot,
// otherwise 'guided', which asks for the main ideas and needs less.
export function pickVariant(estimates) {
  const known = (Array.isArray(estimates) ? estimates : []).filter((e) => e && e.level && e.level !== 'insufficient');
  if (known.length < MIN_UNITS_FOR_OPEN) return 'guided';
  const strong = known.filter((e) => e.level === 'established' || e.level === 'progressing').length;
  const weak = known.filter((e) => e.level === 'needs_help').length;
  return strong / known.length >= STRONG_SHARE && weak / known.length <= WEAK_SHARE ? 'open' : 'guided';
}

export function wording(variant, format) {
  const thing = format === 'pptx' ? 'lecture' : 'reading';
  if (variant === 'open') {
    return {
      prompt: `What have you understood from this ${thing}?`,
      hint: 'Write a few sentences: the main ideas, how they connect, and an example if you can.',
      placeholder: 'What I understood is...',
    };
  }
  return {
    prompt: 'Without looking, write the main ideas of what you just read, in your own words.',
    hint: '',
    placeholder: 'The main ideas were...',
  };
}

// The line about what the instructor sees. Said once, plainly, for class readings only.
export function instructorLine(personal) {
  return personal ? '' : 'Your instructor sees how many students covered each idea, not what you wrote.';
}
