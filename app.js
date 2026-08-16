const passage = document.querySelector('#passage');
const status = document.querySelector('#status');
const tropeToggle = document.querySelector('#trope-toggle');
const scriptToggle = document.querySelector('#script-toggle');

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
let sourceVerses = FALLBACK_VERSES;
let showTrope = false;
let scriptMode = false;
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
    button.setAttribute('aria-label', `Play Exodus chapter 14, verse ${number}`);

    const words = document.createElement('span');
    words.className = 'verse-line';
    words.lang = 'he';
    words.textContent = displayText(text);

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
  const button = event.target.closest('.verse-number');
  if (button) playVerse(button);
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
