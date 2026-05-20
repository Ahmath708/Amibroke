const BLOCKED_PATTERNS = [
  /suicid/i,
  /kill yourself/i,
  /kys/i,
  /die\b/i,
  /death wish/i,
  /end it all/i,
  /worthless person/i,
  /you should die/i,
  /hope you die/i,
  /fat\b/i,
  /ugly\b/i,
  /stupid\b/i,
  /retard/i,
  /nigga/i,
  /fag/i,
  /cunt/i,
  /bitch\b/i,
  /whore/i,
  /slut/i,
  /racist/i,
  /sexist/i,
  /homophobic/i,
];

const SOFTENING_REPLACEMENTS: [string, string][] = [
  ['you are broke', 'your finances are strained'],
  ['you\'re broke', 'you\'re financially strained'],
  ['you\'re poor', 'money is tight right now'],
  ['you are poor', 'money is tight right now'],
  ['you\'re failing', 'you\'re struggling'],
  ['you are failing', 'you\'re struggling'],
  ['you\'re terrible', 'there\'s room for improvement'],
  ['you are terrible', 'there\'s room for improvement'],
  ['you\'re hopeless', 'it feels overwhelming'],
  ['you are hopeless', 'it feels overwhelming'],
  ['you\'re dumb', 'that wasn\'t the smartest move'],
  ['you are dumb', 'that wasn\'t the smartest move'],
];

export function containsBlockedContent(text: string): { blocked: boolean; pattern: string | null } {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, pattern: pattern.source };
    }
  }
  return { blocked: false, pattern: null };
}

export function softenRoast(text: string): string {
  let result = text;
  for (const [bad, good] of SOFTENING_REPLACEMENTS) {
    const regex = new RegExp(bad, 'gi');
    result = result.replace(regex, good);
  }
  return result;
}

export function moderateRoast(text: string): { safe: boolean; text: string; reason: string | null } {
  const { blocked, pattern } = containsBlockedContent(text);

  if (blocked) {
    return {
      safe: false,
      text: "Your financial situation needs some real attention — but let's keep things constructive. Here's the truth: your spending habits need a serious reset.",
      reason: `Blocked content detected: ${pattern}`,
    };
  }

  const softened = softenRoast(text);
  return { safe: true, text: softened, reason: null };
}

export function moderateUserInput(text: string): { safe: boolean; reason: string | null } {
  const lower = text.toLowerCase();

  if (lower.includes('kill') || lower.includes('suicide') || lower.includes('die')) {
    return {
      safe: false,
      reason: 'Detected potentially harmful content. If you\'re in crisis, please reach out to a professional.',
    };
  }

  if (text.length > 5000) {
    return {
      safe: false,
      reason: 'Input too long. Please keep it under 5000 characters.',
    };
  }

  if (text.length < 10) {
    return {
      safe: false,
      reason: 'Please describe your finances in more detail. We need at least a sentence to analyze.',
    };
  }

  return { safe: true, reason: null };
}
