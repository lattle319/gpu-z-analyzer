/**
 * fileDrop.ts
 * ファイル入力用のグローバルなドラッグ＆ドロップ領域を管理します。
 */

export function setupFileDrop(onFilesDrop: (files: File[]) => void) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  overlay.style.color = 'white';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.fontSize = '2rem';
  overlay.style.zIndex = '9999';
  overlay.style.pointerEvents = 'none';
  overlay.innerText = 'Drop files here';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.2s';
  document.body.appendChild(overlay);

  let dragCounter = 0;

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      overlay.style.opacity = '1';
    }
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      overlay.style.opacity = '0';
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    overlay.style.opacity = '0';

    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => {
        const name = f.name.toLowerCase();
        return name.endsWith('.csv') || name.endsWith('.txt');
      });
      if (files.length > 0) {
        onFilesDrop(files);
      }
    }
  });
}
