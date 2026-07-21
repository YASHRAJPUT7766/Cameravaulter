const Vault = (() => {
  let currentFilter = 'all';
  let currentViewFile = null;

  function fileToDataObj(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          name: file.name,
          type: file.type.startsWith('video') ? 'video' : 'image',
          mime: file.type,
          data: reader.result, // base64 data URL
          size: file.size,
          addedAt: Date.now()
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function importFiles(fileList) {
    const files = Array.from(fileList);
    let count = 0;
    for (const f of files) {
      try {
        const obj = await fileToDataObj(f);
        await VaultDB.addFile(obj);
        count++;
      } catch (e) {
        console.error('Import failed for', f.name, e);
      }
    }
    return count;
  }

  async function renderGrid() {
    const grid = document.getElementById('vaultGrid');
    const files = await VaultDB.getAllFiles();
    const filtered = currentFilter === 'all' ? files : files.filter(f => f.type === currentFilter);

    grid.innerHTML = '';

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="vault-empty" id="vaultEmpty">
          <svg viewBox="0 0 24 24" width="40" height="40"><path fill="currentColor" opacity="0.3" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM13.96 12.29l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z"/></svg>
          <p>Vault is empty</p>
          <span>Tap + to import photos or videos</span>
        </div>`;
      return;
    }

    filtered.sort((a, b) => b.addedAt - a.addedAt).forEach(f => {
      const item = document.createElement('div');
      item.className = 'vault-item';
      item.dataset.id = f.id;
      if (f.type === 'image') {
        item.innerHTML = `<img src="${f.data}" loading="lazy">`;
      } else {
        item.innerHTML = `<video src="${f.data}" muted></video>
          <div class="badge"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="#fff" d="M8 5v14l11-7z"/></svg></div>`;
      }
      item.addEventListener('click', () => openViewer(f));
      grid.appendChild(item);
    });
  }

  function setFilter(filter) {
    currentFilter = filter;
    renderGrid();
  }

  function openViewer(fileObj) {
    currentViewFile = fileObj;
    document.getElementById('viewerFilename').textContent = fileObj.name;
    const content = document.getElementById('viewerContent');
    content.innerHTML = '';
    if (fileObj.type === 'image') {
      const img = document.createElement('img');
      img.src = fileObj.data;
      content.appendChild(img);
    } else {
      const vid = document.createElement('video');
      vid.src = fileObj.data;
      vid.controls = true;
      vid.autoplay = true;
      content.appendChild(vid);
    }
    App.showScreen('viewerScreen');
  }

  async function deleteCurrentFile() {
    if (!currentViewFile) return;
    await VaultDB.deleteFile(currentViewFile.id);
    currentViewFile = null;
  }

  function shareCurrentFile() {
    if (!currentViewFile) return;
    // Convert data URL back to a File and use Web Share API if available
    fetch(currentViewFile.data)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], currentViewFile.name, { type: currentViewFile.mime });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: currentViewFile.name }).catch(() => {});
        } else {
          // Fallback: trigger download
          const a = document.createElement('a');
          a.href = currentViewFile.data;
          a.download = currentViewFile.name;
          a.click();
        }
      });
  }

  return { importFiles, renderGrid, setFilter, deleteCurrentFile, shareCurrentFile, get currentViewFile() { return currentViewFile; } };
})();
