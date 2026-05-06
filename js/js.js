    const fileInput = document.getElementById('fileInput');
    const video = document.getElementById('video');
    const stage = document.getElementById('stage');
    const dropLayer = document.getElementById('dropLayer');
    const cropBox = document.getElementById('cropBox');
    const startRange = document.getElementById('startRange');
    const endRange = document.getElementById('endRange');
    const startLabel = document.getElementById('startLabel');
    const endLabel = document.getElementById('endLabel');
    const statusText = document.getElementById('status');
    const progress = document.getElementById('progress');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const result = document.getElementById('result');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const muteBtn = document.getElementById('muteBtn');
    const currentTimeText = document.getElementById('currentTime');
    const resultVideo = document.getElementById('resultVideo');
    const download = document.getElementById('download');

    let objectURL = null;
    let drag = null;
    let previewLoop = null;
    let recording = false;

    function status(message, percent = null) {
      statusText.textContent = message;
      if (percent !== null) progress.style.width = Math.max(0, Math.min(100, percent)) + '%';
    }

    function formatTime(seconds) {
      if (!Number.isFinite(seconds)) return '0.00s';
      return seconds.toFixed(2) + 's';
    }

    function loadFile(file) {
      if (!file) return;
      if (objectURL) URL.revokeObjectURL(objectURL);
      objectURL = URL.createObjectURL(file);
      video.src = objectURL;
      result.classList.add('hidden');
      const sizeGB = file.size / 1024 / 1024 / 1024;
      status(`Loaded local file: ${file.name}${sizeGB > 2 ? ' | Large file mode active' : ''}`, 0);
    }

    function videoRect() {
      const s = stage.getBoundingClientRect();
      const v = video.getBoundingClientRect();
      return { left: v.left - s.left, top: v.top - s.top, width: v.width, height: v.height };
    }

    function setCropPreset(type) {
      if (!video.videoWidth) return;
      const r = videoRect();
      cropBox.classList.remove('hidden');
      let w = r.width, h = r.height, l = r.left, t = r.top;

      if (type === 'square') {
        w = h = Math.min(r.width, r.height) * .86;
        l = r.left + (r.width - w) / 2;
        t = r.top + (r.height - h) / 2;
      } else if (type === 'portrait') {
        const ratio = 9 / 16;
        h = r.height * .9;
        w = h * ratio;
        if (w > r.width * .9) { w = r.width * .9; h = w / ratio; }
        l = r.left + (r.width - w) / 2;
        t = r.top + (r.height - h) / 2;
      } else if (type === 'landscape') {
        const ratio = 16 / 9;
        w = r.width * .9;
        h = w / ratio;
        if (h > r.height * .9) { h = r.height * .9; w = h * ratio; }
        l = r.left + (r.width - w) / 2;
        t = r.top + (r.height - h) / 2;
      }

      cropBox.style.left = l + 'px';
      cropBox.style.top = t + 'px';
      cropBox.style.width = w + 'px';
      cropBox.style.height = h + 'px';
      clampCrop();
    }

    function clampCrop() {
      const r = videoRect();
      let l = parseFloat(cropBox.style.left) || r.left;
      let t = parseFloat(cropBox.style.top) || r.top;
      let w = parseFloat(cropBox.style.width) || r.width;
      let h = parseFloat(cropBox.style.height) || r.height;
      w = Math.max(50, Math.min(w, r.width));
      h = Math.max(50, Math.min(h, r.height));
      l = Math.max(r.left, Math.min(l, r.left + r.width - w));
      t = Math.max(r.top, Math.min(t, r.top + r.height - h));
      cropBox.style.left = l + 'px';
      cropBox.style.top = t + 'px';
      cropBox.style.width = w + 'px';
      cropBox.style.height = h + 'px';
    }

    function cropPixels() {
      const vr = video.getBoundingClientRect();
      const cr = cropBox.getBoundingClientRect();
      const x = Math.max(0, cr.left - vr.left);
      const y = Math.max(0, cr.top - vr.top);
      const w = Math.min(cr.width, vr.width - x);
      const h = Math.min(cr.height, vr.height - y);
      const sx = x * video.videoWidth / vr.width;
      const sy = y * video.videoHeight / vr.height;
      const sw = w * video.videoWidth / vr.width;
      const sh = h * video.videoHeight / vr.height;
      return { sx, sy, sw, sh };
    }

    function updateLabels() {
      let s = Number(startRange.value);
      let e = Number(endRange.value);
      if (s >= e) {
        if (document.activeElement === startRange) startRange.value = Math.max(0, e - .1);
        else endRange.value = Math.min(video.duration || 0, s + .1);
      }
      startLabel.textContent = formatTime(Number(startRange.value));
      endLabel.textContent = formatTime(Number(endRange.value));
    }

    fileInput.addEventListener('change', e => loadFile(e.target.files[0]));

    ['dragenter', 'dragover'].forEach(name => {
      stage.addEventListener(name, e => {
        e.preventDefault();
        stage.classList.add('border-cyan-400');
        dropLayer.classList.remove('opacity-0');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      stage.addEventListener(name, e => {
        e.preventDefault();
        stage.classList.remove('border-cyan-400');
        dropLayer.classList.add('opacity-0');
      });
    });
    stage.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
    document.body.addEventListener('dragover', e => e.preventDefault());
    document.body.addEventListener('drop', e => e.preventDefault());

    video.addEventListener('timeupdate', () => {
      currentTimeText.textContent = formatTime(video.currentTime);
    });

    playPauseBtn.addEventListener('click', async () => {
      if (!video.src) return;
      if (video.paused) {
        await video.play();
        playPauseBtn.textContent = '⏸ Pause';
      } else {
        video.pause();
        playPauseBtn.textContent = '▶ Play';
      }
    });

    muteBtn.addEventListener('click', () => {
      video.muted = !video.muted;
      muteBtn.textContent = video.muted ? '🔇' : '🔊';
    });

    video.addEventListener('pause', () => {
      playPauseBtn.textContent = '▶ Play';
    });

    video.addEventListener('play', () => {
      playPauseBtn.textContent = '⏸ Pause';
    });

    video.addEventListener('loadedmetadata', () => {
      startRange.max = video.duration;
      endRange.max = video.duration;
      startRange.value = 0;
      endRange.value = Math.min(video.duration, 8);
      updateLabels();
      setTimeout(() => setCropPreset('full'), 80);
      status(`Ready: ${video.videoWidth}x${video.videoHeight}, ${formatTime(video.duration)}.`, 0);
    });

    [startRange, endRange].forEach(input => input.addEventListener('input', updateLabels));
    document.getElementById('setStartBtn').addEventListener('click', () => { startRange.value = Math.min(video.currentTime, Number(endRange.value) - .1); updateLabels(); });
    document.getElementById('setEndBtn').addEventListener('click', () => { endRange.value = Math.max(video.currentTime, Number(startRange.value) + .1); updateLabels(); });

    document.querySelectorAll('.preset').forEach(btn => btn.addEventListener('click', () => setCropPreset(btn.dataset.preset)));

    cropBox.addEventListener('pointerdown', e => {
      e.preventDefault();
      cropBox.setPointerCapture(e.pointerId);
      drag = {
        handle: e.target.dataset.handle || 'move',
        x: e.clientX,
        y: e.clientY,
        l: parseFloat(cropBox.style.left),
        t: parseFloat(cropBox.style.top),
        w: parseFloat(cropBox.style.width),
        h: parseFloat(cropBox.style.height)
      };
    });

    cropBox.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      let { l, t, w, h } = drag;
      if (drag.handle === 'move') { l += dx; t += dy; }
      else {
        if (drag.handle.includes('r')) w += dx;
        if (drag.handle.includes('b')) h += dy;
        if (drag.handle.includes('l')) { l += dx; w -= dx; }
        if (drag.handle.includes('t')) { t += dy; h -= dy; }
      }
      cropBox.style.left = l + 'px';
      cropBox.style.top = t + 'px';
      cropBox.style.width = w + 'px';
      cropBox.style.height = h + 'px';
      clampCrop();
    });
    cropBox.addEventListener('pointerup', () => drag = null);
    window.addEventListener('resize', () => video.videoWidth && setCropPreset('full'));

    document.getElementById('playTrimBtn').addEventListener('click', () => {
      if (!video.src) return status('Choose a video first.', 0);
      clearInterval(previewLoop);
      video.currentTime = Number(startRange.value);
      video.play();
      previewLoop = setInterval(() => {
        if (video.currentTime >= Number(endRange.value)) {
          video.pause();
          clearInterval(previewLoop);
          status('Trim preview finished.', 100);
        } else {
          const p = ((video.currentTime - Number(startRange.value)) / (Number(endRange.value) - Number(startRange.value))) * 100;
          status('Previewing selected trim...', p);
        }
      }, 100);
    });

    async function waitForSeek(time) {
      return new Promise(resolve => {
        const done = () => { video.removeEventListener('seeked', done); resolve(); };
        video.addEventListener('seeked', done, { once: true });
        video.currentTime = time;
      });
    }

    function pickMime() {
      const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
    }

    document.getElementById('exportBtn').addEventListener('click', async () => {
      if (!video.src) return status('Choose a video first.', 0);
      if (!window.MediaRecorder || !canvas.captureStream) return status('Your browser does not support video export. Try Chrome/Edge.', 0);
      if (recording) return;

      const start = Number(startRange.value);
      const end = Number(endRange.value);
      const duration = end - start;
      if (duration > 60 && !confirm('Long exports can be slow in browser. Continue?')) return;

      const crop = cropPixels();
      const maxSize = document.getElementById('outputSize').value;
      let outW = crop.sw;
      let outH = crop.sh;
      if (maxSize !== 'original') {
        const max = Number(maxSize);
        const scale = Math.min(1, max / Math.max(outW, outH));
        outW = Math.round(outW * scale);
        outH = Math.round(outH * scale);
      }
      canvas.width = Math.max(2, Math.round(outW / 2) * 2);
      canvas.height = Math.max(2, Math.round(outH / 2) * 2);

      const fps = 30;
      const stream = canvas.captureStream(fps);
      const mimeType = pickMime();
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: Number(document.getElementById('quality').value)
      });
      const chunks = [];
      recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        resultVideo.src = url;
        download.href = url;
        result.classList.remove('hidden');
        status(`Export complete: ${(blob.size / 1024 / 1024).toFixed(2)} MB`, 100);
        recording = false;
      };

      recording = true;
      await waitForSeek(start);
      video.muted = true;
      video.playbackRate = 1;
      await video.play();
      recorder.start(1000);
      status('Exporting cropped video...', 0);

      function draw() {
        if (!recording) return;
        ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
        const percent = ((video.currentTime - start) / duration) * 100;
        status('Exporting cropped video...', percent);
        if (video.currentTime >= end || video.ended) {
          video.pause();
          recorder.stop();
          return;
        }
        requestAnimationFrame(draw);
      }
      draw();
    });
