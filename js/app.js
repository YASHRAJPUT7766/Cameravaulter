const App = (() => {
  let camStream = null;
  let setupStream = null;
  let unlockStream = null;

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  async function startStream(videoEl) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      videoEl.srcObject = stream;
      return stream;
    } catch (e) {
      console.error('Camera access error', e);
      toast('Camera access denied');
      return null;
    }
  }

  function stopStream(stream) {
    if (stream) stream.getTracks().forEach(t => t.stop());
  }

  // ---------- Camera screen (disguise) ----------
  async function initCameraScreen() {
    const video = document.getElementById('camVideo');
    const placeholder = document.getElementById('camPlaceholder');
    placeholder.addEventListener('click', async () => {
      camStream = await startStream(video);
      if (camStream) placeholder.style.display = 'none';
    }, { once: false });

    // Try auto-start
    camStream = await startStream(video);
    if (camStream) placeholder.style.display = 'none';

    // Fake shutter interaction (just a visual click, not saving anywhere —
    // this is a disguise camera, not meant to double as a real camera app)
    document.getElementById('shutterBtn').addEventListener('click', () => {
      document.querySelector('.viewfinder').style.filter = 'brightness(1.6)';
      setTimeout(() => { document.querySelector('.viewfinder').style.filter = ''; }, 120);
    });

    // Tap to focus visual
    document.querySelector('.viewfinder').addEventListener('click', (e) => {
      const ring = document.getElementById('focusRing');
      const rect = e.currentTarget.getBoundingClientRect();
      ring.style.left = (e.clientX - rect.left) + 'px';
      ring.style.top = (e.clientY - rect.top) + 'px';
      ring.classList.remove('show');
      void ring.offsetWidth;
      ring.classList.add('show');
    });

    // Mode switch tabs (visual only)
    document.querySelectorAll('.cam-modes span').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.cam-modes span').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
        document.getElementById('modeLabel').textContent = el.dataset.mode.toUpperCase();
      });
    });
  }

  async function onSettingsGear() {
    stopStream(camStream);
    const enrolled = await FaceLock.isEnrolled();
    if (enrolled) {
      showScreen('unlockScreen');
      const video = document.getElementById('unlockVideo');
      unlockStream = await startStream(video);
    } else {
      showScreen('setupScreen');
      const video = document.getElementById('setupVideo');
      setupStream = await startStream(video);
    }
  }

  // ---------- Setup flow ----------
  function initSetupScreen() {
    const captureBtn = document.getElementById('captureSetupBtn');
    const retryBtn = document.getElementById('retrySetupBtn');
    const confirmBtn = document.getElementById('confirmSetupBtn');
    const ring = document.getElementById('setupRing');
    const status = document.getElementById('setupStatus');
    const video = document.getElementById('setupVideo');

    let capturedOk = false;

    captureBtn.addEventListener('click', async () => {
      if (!video.videoWidth) { toast('Camera not ready yet'); return; }
      status.textContent = 'Hold still...';
      ring.classList.add('scanning');
      captureBtn.style.display = 'none';

      await new Promise(r => setTimeout(r, 1200));
      await FaceLock.saveEnrollment(video);

      ring.classList.remove('scanning');
      ring.classList.add('success');
      status.textContent = 'Face captured successfully';
      capturedOk = true;
      retryBtn.style.display = 'block';
      confirmBtn.style.display = 'block';
    });

    retryBtn.addEventListener('click', async () => {
      await FaceLock.resetEnrollment();
      ring.classList.remove('success');
      status.textContent = 'Align your face inside the circle';
      captureBtn.style.display = 'block';
      retryBtn.style.display = 'none';
      confirmBtn.style.display = 'none';
      capturedOk = false;
    });

    confirmBtn.addEventListener('click', () => {
      stopStream(setupStream);
      toast('Face Lock enabled');
      ring.classList.remove('success');
      captureBtn.style.display = 'block';
      retryBtn.style.display = 'none';
      confirmBtn.style.display = 'none';
      status.textContent = 'Align your face inside the circle';
      openVault();
    });
  }

  // ---------- Unlock flow ----------
  function initUnlockScreen() {
    const scanBtn = document.getElementById('scanBtn');
    const backBtn = document.getElementById('backToCamBtn');
    const ring = document.getElementById('unlockRing');
    const status = document.getElementById('unlockStatus');
    const video = document.getElementById('unlockVideo');

    scanBtn.addEventListener('click', async () => {
      if (!video.videoWidth) { toast('Camera not ready yet'); return; }
      ring.classList.remove('fail', 'success');
      ring.classList.add('scanning');
      status.textContent = 'Scanning...';
      scanBtn.disabled = true;

      await new Promise(r => setTimeout(r, 900));
      const result = await FaceLock.attemptUnlock(video);
      ring.classList.remove('scanning');
      scanBtn.disabled = false;

      if (result.success) {
        ring.classList.add('success');
        status.textContent = 'Face matched';
        setTimeout(() => {
          ring.classList.remove('success');
          stopStream(unlockStream);
          openVault();
        }, 500);
      } else {
        ring.classList.add('fail');
        status.textContent = 'Face not recognized. Try again.';
        setTimeout(() => ring.classList.remove('fail'), 500);
      }
    });

    backBtn.addEventListener('click', () => {
      stopStream(unlockStream);
      showScreen('cameraScreen');
      initCameraScreen();
    });
  }

  // ---------- Vault screen ----------
  async function openVault() {
    showScreen('vaultScreen');
    await Vault.renderGrid();
  }

  function initVaultScreen() {
    document.getElementById('closeVaultBtn').addEventListener('click', () => {
      showScreen('cameraScreen');
      initCameraScreen();
    });

    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', async (e) => {
      if (!e.target.files.length) return;
      toast('Importing...');
      const count = await Vault.importFiles(e.target.files);
      toast(`${count} file${count !== 1 ? 's' : ''} added to vault`);
      await Vault.renderGrid();
      e.target.value = '';
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Vault.setFilter(btn.dataset.tab);
      });
    });

    document.getElementById('vaultSettingsBtn').addEventListener('click', async () => {
      await FaceLock.resetEnrollment();
      toast('Face lock reset. Set up a new one.');
      showScreen('setupScreen');
      const video = document.getElementById('setupVideo');
      setupStream = await startStream(video);
    });
  }

  // ---------- Viewer screen ----------
  function initViewerScreen() {
    document.getElementById('viewerBack').addEventListener('click', () => {
      openVault();
    });
    document.getElementById('viewerDelete').addEventListener('click', async () => {
      if (confirm('Delete this file from vault?')) {
        await Vault.deleteCurrentFile();
        toast('Deleted');
        openVault();
      }
    });
    document.getElementById('viewerShare').addEventListener('click', () => {
      Vault.shareCurrentFile();
    });
  }

  async function init() {
    await initCameraScreen();
    document.getElementById('settingsGear').addEventListener('click', onSettingsGear);
    initSetupScreen();
    initUnlockScreen();
    initVaultScreen();
    initViewerScreen();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  return { init, showScreen, toast };
})();

document.addEventListener('DOMContentLoaded', App.init);
