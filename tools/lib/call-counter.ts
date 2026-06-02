import fs from 'fs';

const COUNTER_FILE = '.api-call-count.json';
const HARD_CAP = 40;

type CounterState = { count: number; startedAt: string; lastCallAt: string | null };

function loadCounter(): CounterState {
  try {
    return JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf-8'));
  } catch {
    return { count: 0, startedAt: new Date().toISOString(), lastCallAt: null };
  }
}

function saveCounter(s: CounterState): void {
  fs.writeFileSync(COUNTER_FILE, JSON.stringify(s, null, 2));
}

export function recordApiCall(reason: string): void {
  const s = loadCounter();
  if (s.count >= HARD_CAP) {
    console.error(`\n❌ HARD CAP REACHED: ${HARD_CAP} API calls already made this session.`);
    console.error(`Counter started: ${s.startedAt}`);
    console.error(`Last call: ${s.lastCallAt ?? 'none'}`);
    console.error(`Ask Jason before continuing. Do NOT delete the counter file.`);
    process.exit(1);
  }
  s.count += 1;
  s.lastCallAt = new Date().toISOString();
  saveCounter(s);
  console.log(`📊 API call ${s.count}/${HARD_CAP} — ${reason}`);
}

export function getCounterState(): CounterState {
  return loadCounter();
}
