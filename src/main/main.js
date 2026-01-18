const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, dialog } = require('electron');
const path = require('path');

// Only enable electron-reload in development (not in packaged app)
if (!app.isPackaged) {
  try {
    require('electron-reload')(__dirname, {
      electron: require(`${__dirname}/../../node_modules/electron`)
    });
  } catch (e) {
    // Ignore if electron-reload is not available
  }
}

// hello
let mainWindow;
let tray = null;
let isWindowLocked = false;

// Register global shortcuts - moved outside createWindow to work in packaged apps
function registerGlobalShortcuts() {
  // Left
  const leftShortcut = globalShortcut.register('CommandOrControl+L', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      const moveAmount = 100;
      mainWindow.setPosition(x - moveAmount, y);
    }
  });
  if (!leftShortcut) {
    console.log('Failed to register Ctrl+L shortcut');
  }

  // Right
  const rightShortcut = globalShortcut.register('CommandOrControl+R', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      const moveAmount = 100;
      mainWindow.setPosition(x + moveAmount, y);
    }
  });
  if (!rightShortcut) {
    console.log('Failed to register Ctrl+R shortcut');
  }

  // Up
  const upShortcut = globalShortcut.register('CommandOrControl+T', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      const moveAmount = 100;
      mainWindow.setPosition(x, y - moveAmount);
    }
  });
  if (!upShortcut) {
    console.log('Failed to register Ctrl+T shortcut');
  }

  // Down
  const downShortcut = globalShortcut.register('CommandOrControl+B', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      const moveAmount = 100;
      mainWindow.setPosition(x, y + moveAmount);
    }
  });
  if (!downShortcut) {
    console.log('Failed to register Ctrl+B shortcut');
  }

  // Hide/Show
  const hideShortcut = globalShortcut.register('CommandOrControl+H', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
  if (!hideShortcut) {
    console.log('Failed to register Ctrl+H shortcut');
  }

  // Close
  const closeShortcut = globalShortcut.register('CommandOrControl+Shift+X', () => {
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 0,
        title: 'Close Window',
        message: 'Are you sure you want to close the window?'
      }).then((result) => {
        if (result.response === 0) {
          mainWindow.close();
          app.quit();
        }
      });
    }
  });
  if (!closeShortcut) {
    console.log('Failed to register Ctrl+Shift+X shortcut');
  }

  console.log('Global shortcuts registered successfully');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 400,
    minHeight: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      webviewTag: true
    },
    skipTaskbar: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    movable: true,
    hasShadow: false,
    titleBarStyle: 'hidden'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // Open DevTools by default (optional, for debugging)
  // mainWindow.webContents.openDevTools();
  mainWindow.setContentProtection(true);

  // Create tray icon
  const iconPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.join(__dirname, '../../assets/icon.png');
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Toggle Lock', 
      click: () => {
        isWindowLocked = !isWindowLocked;
        mainWindow.setMovable(!isWindowLocked);
        mainWindow.setResizable(!isWindowLocked);
        updateTrayContextMenu();
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setToolTip('Gemini Stealth App');
  tray.setContextMenu(contextMenu);

  function updateTrayContextMenu() {
    const updatedMenu = Menu.buildFromTemplate([
      { 
        label: isWindowLocked ? 'Unlock Window' : 'Lock Window', 
        click: () => {
          isWindowLocked = !isWindowLocked;
          mainWindow.setMovable(!isWindowLocked);
          mainWindow.setResizable(!isWindowLocked);
          updateTrayContextMenu();
        }
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]);
    tray.setContextMenu(updatedMenu);
  }
}

ipcMain.on('move-window', (event, { x, y }) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win && win.isMovable()) {
    win.setPosition(x, y);
  }
});

ipcMain.on('toggle-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on('minimize-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  win.minimize();
});

app.whenReady().then(() => {
  createWindow();
  registerGlobalShortcuts();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});