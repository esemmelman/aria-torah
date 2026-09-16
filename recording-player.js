(() => {
  const message = document.querySelector('#playback-status');
  const audio = document.querySelector('#saved-audio');
  const id = location.hash.slice(1);
  // The fragment is a per-recording capability. Never list other recordings
  // or persist this capability in browser storage.
  history.replaceState(null, '', location.pathname + location.search);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    message.textContent = 'Open the playback_url from the Supabase recording table to listen.';
    return;
  }
  let objectUrl;
  async function load() {
    try {
      const response = await fetch(`https://fgomaujsdblpzxhnnqrg.supabase.co/rest/v1/brady_torah_passage_recordings_v1?id=eq.${id}&select=name,start_time,mime_type,audio_base64`, {
        headers: { apikey: 'sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i', 'x-recording-id': id }
      });
      if (!response.ok) throw new Error('Unable to load');
      const [recording] = await response.json();
      if (!recording || recording.name !== 'Aria') {
        message.textContent = 'This recording was deleted or is unavailable.';
        return;
      }
      const bytes = Uint8Array.from(atob(recording.audio_base64), value => value.charCodeAt(0));
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: recording.mime_type }));
      audio.src = objectUrl;
      audio.onerror = () => { message.textContent = 'This browser could not play the recording. Try Chrome or Edge.'; };
      document.querySelector('#saved-start-time').textContent = new Date(recording.start_time).toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles', timeZoneName: 'short'
      });
      document.querySelector('#saved-recording').hidden = false;
      message.textContent = 'Press Play to listen.';
    } catch {
      message.textContent = 'The recording could not be loaded. Open its playback link again to retry.';
    }
  }
  window.addEventListener('pagehide', () => { if (objectUrl) URL.revokeObjectURL(objectUrl); });
  load();
})();
