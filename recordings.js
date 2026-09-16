(() => {
  const button = document.querySelector('#record-button');
  const message = document.querySelector('#record-status');
  const panel = document.querySelector('#current-recording');
  const list = document.querySelector('#recordings-list');
  const endpoint = `${SUPABASE_URL}/rest/v1/brady_torah_passage_recordings_v1`;
  let current = null;
  let recorder = null;
  let timer;
  let ticker;
  let busy = false;

  function lock(value) {
    busy = value;
    window.passageRecordingBusy = value;
  }

  async function request(item, method, body) {
    const response = await fetch(`${endpoint}?id=eq.${item.id}`, {
      method,
      headers: supabaseHeaders({ 'x-recording-id': item.id }),
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!response.ok) throw new Error('Unable to save changes in Supabase.');
  }

  function forgetCurrent() {
    list.querySelector('audio')?.pause();
    if (current) URL.revokeObjectURL(current.url);
    current = null;
    list.replaceChildren();
    panel.hidden = true;
  }

  function base64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function save(item) {
    const audio = await base64(item.blob);
    // An upsert makes retrying safe if a successful response was lost.
    const response = await fetch(`${endpoint}?on_conflict=id`, {
      method: 'POST',
      headers: supabaseHeaders({ 'x-recording-id': item.id, Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ id: item.id, name: item.name, start_time: item.start,
        passage_key: 'exodus-14-15-30', mime_type: item.blob.type.split(';')[0], audio_base64: audio })
    });
    if (!response.ok) throw new Error('Save failed');
    item.saved = true;
  }

  function showCurrent(item) {
    list.replaceChildren();
    const row = document.createElement('tr');
    const cells = Array.from({ length: 4 }, () => row.appendChild(document.createElement('td')));
    const name = document.createElement('span');
    name.textContent = 'Aria';
    cells[0].append(name);
    cells[1].textContent = new Date(item.start).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles', timeZoneName: 'short'
    });
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = item.url;
    audio.setAttribute('aria-label', 'Play current recording');
    cells[2].append(audio);
    const remove = document.createElement('button');
    remove.textContent = 'Delete';
    remove.type = 'button';
    remove.onclick = async () => {
      remove.disabled = true;
      button.disabled = true;
      try {
        // Delete even after a failed save response: the upload may have succeeded.
        await request(item, 'DELETE');
        forgetCurrent();
        message.textContent = 'Recording deleted.';
      } catch {
        message.textContent = 'Could not delete the recording. Please try again.';
        remove.disabled = false;
      } finally { button.disabled = false; }
    };
    cells[3].append(remove);
    if (!item.saved) {
      const retry = document.createElement('button');
      retry.textContent = 'Retry save';
      retry.type = 'button';
      retry.onclick = async () => {
        button.disabled = true;
        retry.disabled = true;
        remove.disabled = true;
        try {
          await save(item);
          showCurrent(item);
          message.textContent = 'Recording saved.';
        } catch {
          message.textContent = 'Save failed. Keep this page open and retry.';
          retry.disabled = false;
          remove.disabled = false;
        } finally { button.disabled = false; }
      };
      cells[0].append(retry);
    }
    list.append(row);
    panel.hidden = false;
  }

  function stop() {
    if (recorder?.state === 'recording') {
      button.disabled = true;
      recorder.stop();
      recorder.stream.getTracks().forEach(track => track.stop());
      clearTimeout(timer);
      clearInterval(ticker);
    }
  }

  button.onclick = async () => {
    if (recorder?.state === 'recording') { stop(); return; }
    if (busy) return;
    if (activeRecorder) {
      message.textContent = 'Stop the colored phrase recording first.';
      return;
    }
    if (current && !current.saved) {
      message.textContent = 'Retry saving or delete the current recording before starting another.';
      return;
    }
    lock(true);
    button.disabled = true;
    message.textContent = 'Waiting for microphone access…';
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredRecordingType();
      const capture = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder = capture;
      const chunks = [];
      const item = { id: crypto.randomUUID(), name: 'Aria', start: new Date().toISOString(), saved: false };
      let failed = false;
      capture.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      capture.onerror = () => { failed = true; stop(); };
      capture.onstop = async () => {
        clearTimeout(timer);
        clearInterval(ticker);
        stream.getTracks().forEach(track => track.stop());
        recorder = null;
        button.disabled = true;
        button.textContent = 'Record';
        button.setAttribute('aria-pressed', 'false');
        item.blob = new Blob(chunks, { type: capture.mimeType || mimeType || 'audio/webm' });
        try {
          if (!item.blob.size) {
            message.textContent = 'No audio was captured. Please record again.';
            return;
          }
          item.url = URL.createObjectURL(item.blob);
          current = item;
          message.textContent = 'Saving recording…';
          await save(item);
          message.textContent = failed ? 'Recording interrupted; captured audio saved.' : 'Recording saved.';
        } catch {
          message.textContent = 'Save failed. Keep this page open and choose Retry save.';
        } finally {
          if (current) showCurrent(item);
          lock(false);
          button.disabled = false;
        }
      };
      resetActiveVerse();
      stopRecordedVerse();
      stopHoveredGroup();
      capture.start(1000);
      forgetCurrent();
      button.textContent = 'Stop recording';
      button.setAttribute('aria-pressed', 'true');
      button.disabled = false;
      const started = Date.now();
      const update = () => {
        const seconds = Math.min(120, Math.floor((Date.now() - started) / 1000));
        message.textContent = `Recording ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} / 2:00. Click again to stop.`;
        if (seconds >= 120) stop();
      };
      update();
      ticker = setInterval(update, 250);
      timer = setTimeout(stop, 120000);
    } catch {
      stream?.getTracks().forEach(track => track.stop());
      recorder = null;
      lock(false);
      button.disabled = false;
      message.textContent = 'Microphone access is required. Allow access and try again.';
    }
  };
  window.addEventListener('beforeunload', event => {
    if (busy || (current && !current.saved)) { event.preventDefault(); event.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  button.disabled = !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder;
  if (button.disabled) message.textContent = 'Recording requires a supported browser and HTTPS (or localhost).';
})();
