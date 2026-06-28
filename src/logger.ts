/**
 * logger.ts
 * 実行ログパネルを管理します。
 * 最新の200行のログを保持し、新しいエントリが追加されると自動的に一番下までスクロールします。
 */

export class Logger {
  private panel: HTMLElement;
  private maxLines = 200;

  constructor(panel: HTMLElement) {
    this.panel = panel;
  }

  log(message: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();

    const line = document.createElement('div');
    line.style.marginBottom = '2px';

    let color = '#cccccc';
    switch (type) {
      case 'warn': color = '#cca700'; break;
      case 'error': color = '#f48771'; break;
      case 'success': color = '#89d185'; break;
      case 'info': color = '#cccccc'; break;
    }

    line.style.color = color;
    line.innerText = `[${timeStr}] ${message}`;

    this.panel.appendChild(line);

    // Cap at 200 lines
    while (this.panel.childElementCount > this.maxLines) {
      this.panel.removeChild(this.panel.firstChild!);
    }

    // Auto-scroll to bottom
    this.panel.scrollTop = this.panel.scrollHeight;
  }
}
