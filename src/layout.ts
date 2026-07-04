/**
 * layout.ts
 * メインレイアウトとリサイズ可能な区切り線を管理します。
 *
 * DOM構造:
 * - container (フルスクリーン)
 *   - top-container (flex row)
 *     - left-sidebar
 *     - v-divider
 *     - main-area
 *     - v-divider-2
 *     - right-sidebar
 *   - h-divider
 *   - panel (下部)
 */

export function createLayout(root: HTMLElement): {
  leftSidebar: HTMLElement;
  mainArea: HTMLElement;
  rightSidebar: HTMLElement;
  panel: HTMLElement;
} {
  // Styles for the layout
  const style = document.createElement('style');
  style.textContent = `
    .layout-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .layout-top {
      display: flex;
      flex: 1;
      min-height: 100px;
      overflow: hidden;
    }
    .layout-sidebar-left {
      width: 250px;
      min-width: 150px;
      background-color: #252526;
      border-right: 1px solid #3c3c3c;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .layout-main {
      flex: 1;
      min-width: 200px;
      background-color: #1e1e1e;
      position: relative;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      padding: 10px;
    }
    .layout-sidebar-right {
      width: 300px;
      min-width: 150px;
      background-color: #252526;
      border-left: 1px solid #3c3c3c;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      overflow-x: auto;
    }
    .layout-panel {
      height: 200px;
      min-height: 100px;
      background-color: #1e1e1e;
      border-top: 1px solid #3c3c3c;
      overflow-y: auto;
      font-family: Consolas, "Courier New", monospace;
      font-size: 12px;
      padding: 5px;
    }
    .resizer-v {
      width: 4px;
      cursor: col-resize;
      background-color: transparent;
      z-index: 10;
    }
    .resizer-v:hover, .resizer-v.resizing {
      background-color: #007acc;
    }
    .resizer-h {
      height: 4px;
      cursor: row-resize;
      background-color: transparent;
      z-index: 10;
    }
    .resizer-h:hover, .resizer-h.resizing {
      background-color: #007acc;
    }
  `;
  document.head.appendChild(style);

  // Layout DOM
  const container = document.createElement('div');
  container.className = 'layout-container';

  const topContainer = document.createElement('div');
  topContainer.className = 'layout-top';

  const leftSidebar = document.createElement('div');
  leftSidebar.className = 'layout-sidebar-left';

  const resizerV1 = document.createElement('div');
  resizerV1.className = 'resizer-v';

  const mainArea = document.createElement('div');
  mainArea.className = 'layout-main';

  const resizerV2 = document.createElement('div');
  resizerV2.className = 'resizer-v';

  const rightSidebar = document.createElement('div');
  rightSidebar.className = 'layout-sidebar-right';

  const resizerH = document.createElement('div');
  resizerH.className = 'resizer-h';

  const panel = document.createElement('div');
  panel.className = 'layout-panel';

  topContainer.appendChild(leftSidebar);
  topContainer.appendChild(resizerV1);
  topContainer.appendChild(mainArea);
  topContainer.appendChild(resizerV2);
  topContainer.appendChild(rightSidebar);

  container.appendChild(topContainer);
  container.appendChild(resizerH);
  container.appendChild(panel);

  root.appendChild(container);

  // Resizing logic
  setupResizerV(resizerV1, leftSidebar, true);
  setupResizerV(resizerV2, rightSidebar, false);
  setupResizerH(resizerH, panel, topContainer);

  return { leftSidebar, mainArea, rightSidebar, panel };
}

function setupResizerV(resizer: HTMLElement, targetElement: HTMLElement, isLeft: boolean) {
  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    if (isLeft) {
      const newWidth = e.clientX;
      if (newWidth > 150 && newWidth < document.body.clientWidth - 400) {
        targetElement.style.width = `${newWidth}px`;
      }
    } else {
      const newWidth = document.body.clientWidth - e.clientX;
      if (newWidth > 150 && newWidth < document.body.clientWidth - 400) {
        targetElement.style.width = `${newWidth}px`;
      }
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove('resizing');
      document.body.style.cursor = '';
    }
  });
}

function setupResizerH(resizer: HTMLElement, targetElement: HTMLElement, topElement: HTMLElement) {
  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'row-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newHeight = document.body.clientHeight - e.clientY;
    if (newHeight > 100 && newHeight < document.body.clientHeight - 200) {
      targetElement.style.height = `${newHeight}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove('resizing');
      document.body.style.cursor = '';
    }
  });
}
