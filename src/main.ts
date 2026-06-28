/**
 * main.ts
 * アプリケーションのエントリーポイントです。
 * 全てのモジュールを初期化し、連携させます。
 */

import { createLayout } from './layout';
import { setupFileDrop } from './fileDrop';
import { Logger } from './logger';
import { SidebarLeft, SidebarState } from './sidebarLeft';
import { ChartManager } from './chartManager';
import { StatisticsManager } from './statistics';
import { AppData, decodeShiftJIS, parseGpuZLog } from './parser';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (!root) return;

  // 1. Setup Layout
  const { leftSidebar, mainArea, rightSidebar, panel } = createLayout(root);

  // 2. Setup Logger
  const logger = new Logger(panel);
  logger.log('Application started.', 'info');

  // Core Data
  let appData: AppData = {};

  // 3. Setup Managers
  const statisticsManager = new StatisticsManager(rightSidebar);

  const chartManager = new ChartManager(mainArea, (filename, dataname, minX, maxX) => {
    statisticsManager.updateRange(filename, dataname, minX, maxX);
  });

  const sidebarLeft = new SidebarLeft(leftSidebar, (state: SidebarState) => {
    chartManager.updateState(state);
    statisticsManager.updateState(state);
  });

  // 4. Handle File Drops
  setupFileDrop(async (files: File[]) => {
    logger.log(`Received ${files.length} file(s)...`, 'info');

    for (const file of files) {
      try {
        logger.log(`Loading file: ${file.name}`, 'info');
        const buffer = await file.arrayBuffer();

        // Decode as Shift-JIS
        const text = decodeShiftJIS(buffer);

        // Parse
        logger.log(`Parsing file: ${file.name}`, 'info');
        const fileData = parseGpuZLog(text);

        const datasetsCount = Object.keys(fileData).length;
        if (datasetsCount === 0) {
          logger.log(`No valid datasets found in ${file.name}`, 'warn');
          continue;
        }

        appData[file.name] = fileData;
        logger.log(`Successfully parsed ${datasetsCount} dataset(s) from ${file.name}`, 'success');

      } catch (err: any) {
        logger.log(`Error processing ${file.name}: ${err.message}`, 'error');
      }
    }

    // Update UI components with new data
    sidebarLeft.updateData(appData);
    chartManager.updateData(appData);
    statisticsManager.updateData(appData);
  });

  logger.log('Ready. Drop GPU-Z log files anywhere on the page to begin.', 'success');
});
