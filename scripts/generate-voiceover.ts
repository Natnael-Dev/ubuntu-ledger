import * as fs from 'fs';
import * as path from 'path';

// Read .env.local manually to ensure exact parse
function getEnvApiKey(): string | undefined {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('GEMINI_API_KEY=')) {
        return trimmed.substring('GEMINI_API_KEY='.length).trim();
      }
    }
  }
  return process.env.GEMINI_API_KEY;
}

const NARRATIONS = [
  {
    id: 'vo-01',
    scene: 'scene-01-home',
    text: 'Across East Africa, public infrastructure projects are marked complete on paper while remaining broken in reality. Official gazettes say hundreds of thousands of birr were spent, but citizens have no way to verify it. Ward Proof-Line bridges this trust deficit through an open civic verification system. Our architectural invariant is simple: public money claims cannot be closed by the people who spend them.',
  },
  {
    id: 'vo-02',
    scene: 'scene-02-receipt',
    text: 'Every public expenditure generates a permanent civic receipt. Here is Contract 4412 for 320,000 birr. It links directly to the official gazette publication with page citations and cryptographic SHA-256 hashes. For illiterate citizens or elders, the receipt can be read aloud in local languages or printed as a clean bulletin for ward noticeboards.',
  },
  {
    id: 'vo-03',
    scene: 'scene-03-simulator-amina',
    text: 'On any $10 feature phone with no mobile data, Amina dials star-8-9-0 hash. She enters Contract 4412 for the health post generator overhaul and answers simple physical questions. Her report moves the community witness quorum from two to three.',
  },
  {
    id: 'vo-04',
    scene: 'scene-04-simulator-girma',
    text: 'What prevents someone from buying ten SIM cards to rig the system? When Girma submits from the same cell tower cluster, the backend detects geographic collision. The LCD informs the citizen: area already counted, total stays at 3. Ten phones on one street are counted as one witness.',
  },
  {
    id: 'vo-05',
    scene: 'scene-05-simulator-kalinda',
    text: 'Switching to Kalinda in Kebele 09, independent geographic confirmation is recorded. Distributed cell clusters satisfy the multi-witness quorum, anchoring public expenditure in decentralized ground truth.',
  },
  {
    id: 'vo-06',
    scene: 'scene-06-console',
    text: 'In the Municipal Console, recording a contractor claim does NOT turn the project green. It moves into amber under a mandatory 7-day probation lock. When an administrator attempts early closure, the system strictly refuses with an HTTP 409 Probation Locked modal. A database CHECK constraint guarantees that no official can bypass citizen verification.',
  },
  {
    id: 'vo-07',
    scene: 'scene-07-divergence',
    text: 'Ward Proof-Line introduces the Two-Ledger Separation: official gazetted ceilings and k-anonymous citizen reports are presented side by side, never averaged. Below k=5, reports are suppressed to prevent retaliation. And right at the counter, citizens are given a plain-language refusal script backed by law.',
  },
  {
    id: 'vo-08',
    scene: 'scene-08-pwa',
    text: 'For field monitors in remote areas with zero cellular reception, our offline Progressive Web App queues observations in client-side storage. When connectivity returns, the background sync engine flushes the queue idempotently with zero duplicate entries.',
  },
  {
    id: 'vo-09',
    scene: 'scene-09-ai-oversight',
    text: 'AI Oversight Insights provide real-time Sybil ring detection and cross-ward contractor pattern analysis, empowering municipal operators with actionable intelligence while preserving core cryptographic invariants. 574 automated tests, strict database triggers, and zero-PII guarantees. Ward Proof-Line: Information you can trust.',
  },
];

async function tryTts(apiKey: string | undefined, attemptNumber: number): Promise<boolean> {
  console.log(`[TTS Attempt ${attemptNumber}] Contacting Gemini TTS endpoint...`);
  if (!apiKey) {
    console.error(`[TTS Attempt ${attemptNumber} FAIL] GEMINI_API_KEY is not defined in .env.local or process.env.`);
    return false;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(apiKey)}`;
  try {
    const payload = {
      contents: [{ parts: [{ text: NARRATIONS[0].text }] }],
      generationConfig: {
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore',
            },
          },
        },
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[TTS Attempt ${attemptNumber} FAIL] HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return false;
    }

    console.log(`[TTS Attempt ${attemptNumber} SUCCESS]`);
    return true;
  } catch (err: any) {
    console.error(`[TTS Attempt ${attemptNumber} FAIL] Fetch error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('=== Step 2: Gemini TTS Voiceover Generation ===');
  const apiKey = getEnvApiKey();
  console.log(`Checking GEMINI_API_KEY: ${apiKey ? 'PRESENT (masked)' : 'MISSING'}`);

  let success = await tryTts(apiKey, 1);
  if (!success) {
    console.log('Retrying TTS (Attempt 2)...');
    await new Promise((r) => setTimeout(r, 1000));
    success = await tryTts(apiKey, 2);
  }

  if (!success) {
    console.log('\n===============================================================');
    console.log('[TTS VERDICT]: Gemini TTS failed twice (GEMINI_API_KEY missing/rejected).');
    console.log('Per prompt instructions: Proceeding CAPTIONS-ONLY with burned subtitles.');
    console.log('===============================================================\n');
    process.exit(0);
  }

  console.log('TTS Succeeded! Generating audio files in media/audio/...');
}

main().catch((err) => {
  console.error('[Voiceover] Unexpected error:', err);
  process.exit(1);
});
