const passage = document.querySelector('#passage');
const status = document.querySelector('#status');
const tropeToggle = document.querySelector('#trope-toggle');
const scriptToggle = document.querySelector('#script-toggle');
const SUPABASE_URL = 'https://fgomaujsdblpzxhnnqrg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i';
const SUPABASE_STORAGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnb21hdWpzZGJscHp4aG5ucXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNjM3MjYsImV4cCI6MjA5OTgzOTcyNn0.1iMPI_7F_8ioNVnuThxqAKfMfD7G4NbyXilXZEERScw';
const HIGHLIGHT_TABLE = 'aria_torah_highlight_groups_v1';
const RECORDING_TABLE = 'aria_torah_group_recordings_v1';
const RECORDING_BUCKET = 'aria-torah-group-recordings-v1';
const PASSAGE_KEY = 'exodus-14-15-30';

const FALLBACK_VERSES = [
  'ויאמר יהוה אל משה מה תצעק אלי דבר אל בני ישראל ויסעו׃',
  'ואתה הרם את מטך ונטה את ידך על הים ובקעהו ויבאו בני ישראל בתוך הים ביבשה׃',
  'ואני הנני מחזק את לב מצרים ויבאו אחריהם ואכבדה בפרעה ובכל חילו ברכבו ובפרשיו׃',
  'וידעו מצרים כי אני יהוה בהכבדי בפרעה ברכבו ובפרשיו׃',
  'ויסע מלאך האלהים ההלך לפני מחנה ישראל וילך מאחריהם ויסע עמוד הענן מפניהם ויעמד מאחריהם׃',
  'ויבא בין מחנה מצרים ובין מחנה ישראל ויהי הענן והחשך ויאר את הלילה ולא קרב זה אל זה כל הלילה׃',
  'ויט משה את ידו על הים ויולך יהוה את הים ברוח קדים עזה כל הלילה וישם את הים לחרבה ויבקעו המים׃',
  'ויבאו בני ישראל בתוך הים ביבשה והמים להם חמה מימינם ומשמאלם׃',
  'וירדפו מצרים ויבאו אחריהם כל סוס פרעה רכבו ופרשיו אל תוך הים׃',
  'ויהי באשמרת הבקר וישקף יהוה אל מחנה מצרים בעמוד אש וענן ויהם את מחנה מצרים׃',
  'ויסר את אפן מרכבתיו וינהגהו בכבדת ויאמר מצרים אנוסה מפני ישראל כי יהוה נלחם להם במצרים׃',
  'ויאמר יהוה אל משה נטה את ידך על הים וישבו המים על מצרים על רכבו ועל פרשיו׃',
  'ויט משה את ידו על הים וישב הים לפנות בקר לאיתנו ומצרים נסים לקראתו וינער יהוה את מצרים בתוך הים׃',
  'וישבו המים ויכסו את הרכב ואת הפרשים לכל חיל פרעה הבאים אחריהם בים לא נשאר בהם עד אחד׃',
  'ובני ישראל הלכו ביבשה בתוך הים והמים להם חמה מימינם ומשמאלם׃',
  'ויושע יהוה ביום ההוא את ישראל מיד מצרים וירא ישראל את מצרים מת על שפת הים׃'
];

const audioByVerse = new Map();
let activeVerse = null;
let activePlaylist = null;
let sourceVerses = FALLBACK_VERSES;
let showTrope = false;
let scriptMode = false;
const HIGHLIGHT_STORAGE_KEY = 'aria-torah-highlights-v1';
let highlights = loadHighlights();
let highlightsReady = false;
const recordings = new Map();
let activeRecorder = null;
const ALIYAH_HEADINGS = new Map([
  [15, 'Aliya 1'],
  [19, 'Aliyah 2'],
  [23, 'Aliyah 3'],
  [27, 'Aliyah 4']
]);

function findRecording(value, verseNumber) {
  const candidates = [];

  function visit(item) {
    if (!item || typeof item !== 'object') return;
    const strings = Object.values(item).filter(child => typeof child === 'string');
    const url = strings.find(child => /\.(mp3|m4a|ogg|wav)(?:[?#]|$)/i.test(child));
    if (url) {
      const description = JSON.stringify(item);
      const exactRef = new RegExp(`Exodus(?:\\.| )14(?:\\.|:)${verseNumber}(?!\\d)`, 'i');
      candidates.push({
        url,
        start: Number(item.start_time ?? item.startTime ?? item.start ?? 0),
        end: Number(item.end_time ?? item.endTime ?? item.end ?? 0),
        score: exactRef.test(description) ? 1 : 0
      });
    }
    Object.values(item).forEach(visit);
  }

  visit(value);
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function stripHtml(value) {
  const template = document.createElement('template');
  template.innerHTML = value;
  return template.content.textContent.trim();
}

function loadHighlights() {
  try {
    const saved = JSON.parse(localStorage.getItem(HIGHLIGHT_STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
    ...extra
  };
}

function highlightForWord(verse, wordIndex) {
  return highlights.find(item => item.verse === verse && wordIndex >= item.start && wordIndex <= item.end);
}

async function loadRemoteHighlights() {
  const locallySaved = loadHighlights();
  try {
    if (locallySaved.length) {
      const migrationRows = locallySaved.map(item => ({
        passage_key: PASSAGE_KEY,
        verse: item.verse,
        start_word: item.start,
        end_word: item.end,
        color: item.color
      }));
      const migrationResponse = await fetch(`${SUPABASE_URL}/rest/v1/${HIGHLIGHT_TABLE}?on_conflict=passage_key,verse,start_word,end_word`, {
        method: 'POST',
        headers: supabaseHeaders({ Prefer: 'resolution=ignore-duplicates' }),
        body: JSON.stringify(migrationRows)
      });
      if (!migrationResponse.ok) throw new Error('Local highlight migration failed');
      localStorage.removeItem(HIGHLIGHT_STORAGE_KEY);
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${HIGHLIGHT_TABLE}?passage_key=eq.${PASSAGE_KEY}&select=id,verse,start_word,end_word,color&order=id.asc`, {
      headers: supabaseHeaders()
    });
    if (!response.ok) throw new Error('Highlight request failed');
    highlights = (await response.json()).map(item => ({
      id: item.id,
      verse: item.verse,
      start: item.start_word,
      end: item.end_word,
      color: item.color
    }));
    highlightsReady = true;
    await loadRecordings();
    updateDisplay();
  } catch (error) {
    status.textContent = 'Saved highlights could not be loaded. You can still read the passage.';
  }
}

async function loadRecordings() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${RECORDING_TABLE}?select=highlight_group_id,object_path,mime_type,byte_size`, {
    headers: supabaseHeaders()
  });
  if (!response.ok) throw new Error('Recording request failed');
  recordings.clear();
  (await response.json()).forEach(item => recordings.set(item.highlight_group_id, item));
}

function recordingUrl(objectPath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${RECORDING_BUCKET}/${objectPath}`;
}

function preferredRecordingType() {
  const types = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function recordingExtension(mimeType) {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'mp4';
  return 'webm';
}

async function uploadRecording(groupId, blob) {
  const mimeType = blob.type.split(';')[0] || 'audio/webm';
  const objectPath = `groups/${groupId}.${recordingExtension(mimeType)}`;
  const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${RECORDING_BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_STORAGE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_STORAGE_ANON_KEY}`,
      'Content-Type': mimeType,
      'x-upsert': 'true'
    },
    body: blob
  });
  if (!uploadResponse.ok) throw new Error('Audio upload failed');

  const metadataResponse = await fetch(`${SUPABASE_URL}/rest/v1/${RECORDING_TABLE}?on_conflict=highlight_group_id`, {
    method: 'POST',
    headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify({
      highlight_group_id: groupId,
      object_path: objectPath,
      mime_type: mimeType,
      byte_size: blob.size,
      updated_at: new Date().toISOString()
    })
  });
  if (!metadataResponse.ok) throw new Error('Recording metadata save failed');
  const [saved] = await metadataResponse.json();
  recordings.set(groupId, saved);
}

async function toggleGroupRecording(button) {
  if (!highlightsReady) {
    status.textContent = 'Please wait for saved groups to finish loading.';
    return;
  }
  const groupId = Number(button.dataset.groupId);
  if (activeRecorder) {
    if (activeRecorder.groupId !== groupId) {
      status.textContent = 'Stop the current recording before starting another group.';
      return;
    }
    activeRecorder.recorder.stop();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    status.textContent = 'Audio recording is not supported in this browser.';
    return;
  }

  try {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
    } catch (error) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    const mimeType = preferredRecordingType();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 256000
      });
    } catch (error) {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    }
    const chunks = [];
    recorder.ondataavailable = event => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      button.disabled = true;
      button.textContent = '↑';
      status.textContent = `Saving recording for group ${groupId}…`;
      try {
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        await uploadRecording(groupId, blob);
        status.textContent = `Recording saved for group ${groupId}.`;
      } catch (error) {
        status.textContent = 'The recording could not be saved. Please record this group again.';
      } finally {
        activeRecorder = null;
        updateDisplay();
      }
    };
    activeRecorder = { groupId, recorder };
    recorder.start(1000);
    button.classList.add('recording');
    button.textContent = '■';
    button.setAttribute('aria-label', `Stop recording group ${groupId}`);
    status.textContent = `Recording group ${groupId} in high quality. Select stop when finished.`;
  } catch (error) {
    status.textContent = 'Microphone access is required to record this group.';
  }
}

function playGroupRecording(button) {
  stopRecordedVerse();
  const groupId = Number(button.dataset.groupId);
  const recording = recordings.get(groupId);
  if (!recording) return;
  const audio = new Audio(`${recordingUrl(recording.object_path)}?v=${Date.now()}`);
  button.disabled = true;
  audio.onended = () => { button.disabled = false; };
  audio.onerror = () => {
    button.disabled = false;
    status.textContent = 'The saved group recording could not be played.';
  };
  audio.play();
  status.textContent = `Playing recording for group ${groupId}.`;
}

function displayText(text) {
  if (scriptMode) return text.normalize('NFD').replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, '');
  if (!showTrope) return text.replace(/[\u0591-\u05AF]/g, '');
  return text;
}

function updateDisplay() {
  document.body.classList.toggle('script-mode', scriptMode);
  tropeToggle.classList.toggle('active', showTrope);
  tropeToggle.setAttribute('aria-pressed', String(showTrope));
  scriptToggle.classList.toggle('active', scriptMode);
  scriptToggle.setAttribute('aria-pressed', String(scriptMode));
  renderVerses(sourceVerses);
}

function renderVerses(texts) {
  passage.replaceChildren();
  texts.forEach((text, index) => {
    const number = index + 15;
    if (ALIYAH_HEADINGS.has(number)) {
      const heading = document.createElement('h2');
      heading.className = 'aliyah-heading';
      heading.textContent = ALIYAH_HEADINGS.get(number);
      passage.append(heading);
    }
    const row = document.createElement('div');
    row.className = 'verse-row';
    row.dir = 'rtl';

    const button = document.createElement('button');
    button.className = 'verse-number';
    button.type = 'button';
    button.textContent = number;
    button.dataset.verse = number;
    button.setAttribute('aria-label', `Play all saved group recordings for verse ${number}`);

    const words = document.createElement('span');
    words.className = 'verse-line';
    words.lang = 'he';
    words.dataset.verse = number;

    const displayedText = displayText(text);
    const tokens = displayedText.trim().split(/\s+/);
    tokens.forEach((token, wordIndex) => {
      const word = document.createElement('span');
      word.className = 'word';
      word.dataset.word = wordIndex;
      word.textContent = token;
      const highlight = highlightForWord(number, wordIndex);
      if (highlight) word.classList.add(`highlight-${highlight.color}`);
      words.append(word);

      if (wordIndex < tokens.length - 1) {
        const space = document.createElement('span');
        space.className = 'word-space';
        space.textContent = ' ';
        const nextHighlight = highlightForWord(number, wordIndex + 1);
        if (highlight && nextHighlight === highlight) space.classList.add(`highlight-${highlight.color}`);
        words.append(space);
      }

      if (!scriptMode && highlight && wordIndex === highlight.end) {
        const controls = document.createElement('span');
        controls.className = 'group-audio-controls';

        const recordButton = document.createElement('button');
        recordButton.type = 'button';
        recordButton.className = 'group-audio-button record-group';
        recordButton.dataset.groupId = highlight.id;
        recordButton.textContent = '●';
        recordButton.setAttribute('aria-label', `${recordings.has(highlight.id) ? 'Re-record' : 'Record'} highlighted group ${highlight.id}`);
        recordButton.title = recordings.has(highlight.id) ? 'Re-record this group' : 'Record this group';
        controls.append(recordButton);

        if (recordings.has(highlight.id)) {
          const playButton = document.createElement('button');
          playButton.type = 'button';
          playButton.className = 'group-audio-button play-group';
          playButton.dataset.groupId = highlight.id;
          playButton.textContent = '▶';
          playButton.setAttribute('aria-label', `Play recording for highlighted group ${highlight.id}`);
          playButton.title = 'Play saved recording';
          controls.append(playButton);
        }
        words.append(controls);
      }
    });

    row.append(button, words);
    passage.append(row);
  });
}

async function loadPointedText() {
  try {
    const response = await fetch('https://www.sefaria.org/api/texts/Exodus.14.15-30?context=0');
    if (!response.ok) throw new Error('Text request failed');
    const data = await response.json();
    if (!Array.isArray(data.he) || data.he.length !== 16) throw new Error('Unexpected passage');
    sourceVerses = data.he.map(stripHtml);
    updateDisplay();
  } catch (error) {
    // The unpointed passage is already visible when the text API is unavailable.
  }
}

function resetActiveVerse() {
  if (!activeVerse) return;
  activeVerse.audio.pause();
  activeVerse.audio.ontimeupdate = null;
  activeVerse.button.classList.remove('playing');
  activeVerse.button.textContent = activeVerse.number;
  activeVerse = null;
}

function stopRecordedVerse(message = '') {
  if (!activePlaylist) return;
  activePlaylist.audio?.pause();
  activePlaylist.finishCurrent?.();
  activePlaylist.button.classList.remove('playing');
  activePlaylist.button.textContent = activePlaylist.number;
  activePlaylist = null;
  if (message) status.textContent = message;
}

async function playRecordedVerse(button) {
  const number = Number(button.dataset.verse);
  if (activePlaylist?.number === number) {
    stopRecordedVerse(`Verse ${number} playback stopped.`);
    return;
  }

  stopRecordedVerse();
  resetActiveVerse();
  const groups = highlights
    .filter(group => group.verse === number && recordings.has(group.id))
    .sort((a, b) => a.start - b.start);

  if (!groups.length) {
    status.textContent = `Verse ${number} has no saved group recordings.`;
    return;
  }

  const token = Symbol('verse-playlist');
  activePlaylist = { number, button, token, audio: null, finishCurrent: null };
  button.classList.add('playing');
  button.textContent = '■';

  try {
    for (let index = 0; index < groups.length; index += 1) {
      if (activePlaylist?.token !== token) return;
      const recording = recordings.get(groups[index].id);
      const audio = new Audio(recordingUrl(recording.object_path));
      activePlaylist.audio = audio;
      status.textContent = `Playing verse ${number}: group ${index + 1} of ${groups.length}.`;
      await new Promise((resolve, reject) => {
        activePlaylist.finishCurrent = resolve;
        audio.onended = resolve;
        audio.onerror = reject;
        audio.play().catch(reject);
      });
    }

    if (activePlaylist?.token === token) {
      stopRecordedVerse(`Verse ${number} complete.`);
    }
  } catch (error) {
    if (activePlaylist?.token === token) {
      stopRecordedVerse(`A saved recording in verse ${number} could not be played.`);
    }
  }
}

async function playVerse(button) {
  const number = Number(button.dataset.verse);
  if (activeVerse?.number === number && !activeVerse.audio.paused) {
    resetActiveVerse();
    status.textContent = `Verse ${number} paused.`;
    return;
  }

  resetActiveVerse();
  status.textContent = `Loading verse ${number}…`;
  button.disabled = true;

  try {
    let audio = audioByVerse.get(number);
    if (!audio) {
      const response = await fetch(`https://www.sefaria.org/api/related/Exodus.14.${number}?with_sheet_links=0`);
      if (!response.ok) throw new Error('Recording request failed');
      const recording = findRecording(await response.json(), number);
      if (!recording) throw new Error('Recording not found');
      audio = new Audio(recording.url);
      audio.clipStart = recording.start;
      audio.clipEnd = recording.end;
      audio.preload = 'auto';
      audioByVerse.set(number, audio);
    }

    activeVerse = { number, audio, button };
    button.classList.add('playing');
    button.textContent = '■';
    audio.currentTime = audio.clipStart || 0;
    audio.ontimeupdate = () => {
      if (audio.clipEnd > audio.clipStart && audio.currentTime >= audio.clipEnd) {
        audio.pause();
        audio.dispatchEvent(new Event('ended'));
      }
    };
    audio.onended = () => {
      if (activeVerse?.audio !== audio) return;
      resetActiveVerse();
      status.textContent = `Verse ${number} complete.`;
    };
    await audio.play();
    status.textContent = `Playing verse ${number}.`;
  } catch (error) {
    resetActiveVerse();
    status.innerHTML = `Verse ${number} could not be loaded here. <a href="https://www.sefaria.org/Exodus.14.${number}?lang=bi&with=Torah%20Readings" target="_blank" rel="noopener">Listen on Sefaria</a>.`;
  } finally {
    button.disabled = false;
  }
}

passage.addEventListener('click', event => {
  const recordButton = event.target.closest('.record-group');
  if (recordButton) {
    toggleGroupRecording(recordButton);
    return;
  }
  const playButton = event.target.closest('.play-group');
  if (playButton) {
    playGroupRecording(playButton);
    return;
  }
  const button = event.target.closest('.verse-number');
  if (button) playRecordedVerse(button);
});

passage.addEventListener('mouseup', async () => {
  if (scriptMode) return;
  if (!highlightsReady) {
    status.textContent = 'Please wait for saved highlights to finish loading.';
    return;
  }
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const selectedWords = [...passage.querySelectorAll('.verse-line .word')].filter(word => {
    try {
      return range.intersectsNode(word);
    } catch (error) {
      return false;
    }
  });
  if (!selectedWords.length) return;

  const line = selectedWords[0].closest('.verse-line');
  if (!selectedWords.every(word => word.closest('.verse-line') === line)) {
    selection.removeAllRanges();
    status.textContent = 'Highlight one verse at a time.';
    return;
  }

  const verse = Number(line.dataset.verse);
  const indices = selectedWords.map(word => Number(word.dataset.word));
  const start = Math.min(...indices);
  const end = Math.max(...indices);
  const overlapping = highlights.filter(item => item.verse === verse && item.start <= end && item.end >= start);

  if (overlapping.length) {
    try {
      const ids = overlapping.map(item => item.id).filter(Boolean).join(',');
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${HIGHLIGHT_TABLE}?id=in.(${ids})`, {
        method: 'DELETE',
        headers: supabaseHeaders()
      });
      if (!response.ok) throw new Error('Delete failed');
      highlights = highlights.filter(item => !overlapping.includes(item));
      selection.removeAllRanges();
      updateDisplay();
      status.textContent = `Cleared highlighting in verse ${verse}.`;
    } catch (error) {
      status.textContent = 'The highlight could not be cleared. Please try again.';
    }
    return;
  }

  const nextColor = highlights.length ? (highlights.at(-1).color % 2) + 1 : 1;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${HIGHLIGHT_TABLE}`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({ passage_key: PASSAGE_KEY, verse, start_word: start, end_word: end, color: nextColor })
    });
    if (!response.ok) throw new Error('Save failed');
    const [saved] = await response.json();
    highlights.push({ id: saved.id, verse, start, end, color: nextColor });
    selection.removeAllRanges();
    updateDisplay();
    status.textContent = `Highlighted and saved a word group in verse ${verse}.`;
  } catch (error) {
    status.textContent = 'The highlight could not be saved. Please try again.';
  }
});

tropeToggle.addEventListener('click', () => {
  showTrope = !showTrope;
  updateDisplay();
});

scriptToggle.addEventListener('click', () => {
  scriptMode = !scriptMode;
  updateDisplay();
});

updateDisplay();
loadPointedText();
loadRemoteHighlights();
