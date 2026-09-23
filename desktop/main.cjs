/**
 * Electron shell for the Villa Khan viewer — the macOS / Windows desktop app.
 *
 * The web app is unchanged and unbundled: the same src/*.js modules, the same
 * import map, the same plan JPEG. The one thing the desktop needs is an
 * origin. Chromium refuses ES modules and canvas reads over `file://`, which
 * is exactly why `npm start` exists, so instead of shipping a local HTTP
 * server this registers a custom `villa://` scheme, privileged as standard +
 * secure, and serves the project directory through it. To the page it is
 * indistinguishable from the dev server; nothing listens on a port.
 */
const { app, BrowserWindow, protocol, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const ROOT = path.join(__dirname, '..');
const SCHEME = 'villa';
const START = `${SCHEME}://app/walk.html`;

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
};

/**
 * Serve one file out of the project directory, refusing anything outside it.
 * Reads through fs rather than fetching a file:// URL because packaged builds
 * live inside an asar archive, which Electron's fs understands and a raw
 * file:// fetch does not.
 */
async function serve(request) {
  const url = new URL(request.url);
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'walk.html';
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) return new Response('Forbidden', { status: 403 });
  try {
    const body = await fs.readFile(file);
    const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    return new Response(body, { headers: { 'content-type': type } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#11151b',
    title: 'Villa Khan',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Walking needs the mouse captured; nothing else here asks for permissions.
  win.webContents.session.setPermissionRequestHandler((_wc, permission, done) => {
    done(permission === 'pointerLock' || permission === 'fullscreen');
  });

  // Links open in the user's browser, never as a second app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => win.show());
  win.loadURL(START);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'View',
      submenu: [
        {
          label: 'Walk Inside the House',
          accelerator: 'F',
          click: () => win?.webContents.executeJavaScript(
            "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))",
          ),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ]));
}

app.whenReady().then(() => {
  protocol.handle(SCHEME, serve);
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
