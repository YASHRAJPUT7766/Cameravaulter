// Basic (non-ML) face lock: captures a downsampled grayscale "signature"
// of the face region and compares similarity on unlock attempts.
// NOTE: this is a lightweight image-similarity check, not true biometric
// face recognition. Good enough as a deterrent + basic gate, not bank-grade security.

const FaceLock = (() => {
  const SIG_SIZE = 32; // 32x32 grayscale signature
  const MATCH_THRESHOLD = 0.82; // similarity score needed to unlock

  function computeSignature(videoEl) {
    const canvas = document.createElement('canvas');
    canvas.width = SIG_SIZE;
    canvas.height = SIG_SIZE;
    const ctx = canvas.getContext('2d');

    // Crop to center square (assume face roughly centered in frame)
    const vw = videoEl.videoWidth, vh = videoEl.videoHeight;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;

    ctx.drawImage(videoEl, sx, sy, side, side, 0, 0, SIG_SIZE, SIG_SIZE);
    const imgData = ctx.getImageData(0, 0, SIG_SIZE, SIG_SIZE).data;

    const gray = new Float32Array(SIG_SIZE * SIG_SIZE);
    for (let i = 0; i < SIG_SIZE * SIG_SIZE; i++) {
      const r = imgData[i * 4], g = imgData[i * 4 + 1], b = imgData[i * 4 + 2];
      gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }
    // Normalize (mean 0) to reduce lighting sensitivity
    let mean = 0;
    for (let i = 0; i < gray.length; i++) mean += gray[i];
    mean /= gray.length;
    for (let i = 0; i < gray.length; i++) gray[i] -= mean;

    return Array.from(gray);
  }

  function similarity(sigA, sigB) {
    if (!sigA || !sigB || sigA.length !== sigB.length) return 0;
    // Cosine similarity
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < sigA.length; i++) {
      dot += sigA[i] * sigB[i];
      magA += sigA[i] * sigA[i];
      magB += sigB[i] * sigB[i];
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  async function saveEnrollment(videoEl) {
    // Capture 3 samples for a slightly more robust average signature
    const samples = [];
    for (let i = 0; i < 3; i++) {
      samples.push(computeSignature(videoEl));
      await new Promise(r => setTimeout(r, 180));
    }
    const avg = samples[0].map((_, idx) => {
      return (samples[0][idx] + samples[1][idx] + samples[2][idx]) / 3;
    });
    await VaultDB.setMeta('face_signature', avg);
    await VaultDB.setMeta('face_enrolled', true);
    return true;
  }

  async function isEnrolled() {
    const v = await VaultDB.getMeta('face_enrolled');
    return !!v;
  }

  async function attemptUnlock(videoEl) {
    const stored = await VaultDB.getMeta('face_signature');
    if (!stored) return { success: false, score: 0 };
    const current = computeSignature(videoEl);
    const score = similarity(stored, current);
    return { success: score >= MATCH_THRESHOLD, score };
  }

  async function resetEnrollment() {
    await VaultDB.setMeta('face_enrolled', false);
    await VaultDB.setMeta('face_signature', null);
  }

  return { saveEnrollment, isEnrolled, attemptUnlock, resetEnrollment };
})();
