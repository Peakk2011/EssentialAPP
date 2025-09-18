const fs = require('fs');
const path = require('path');

class ContextMenu {
  constructor(translations, links, cssPath) {
    this.translations = translations ?? {};
    this.links = links ?? {};
    this.cssPath = cssPath;
    // Pre-read the CSS file to avoid reading it on every menu creation.
    this.cssContentPromise = fs.promises.readFile(this.cssPath, 'utf8');
  }

  async create(pos) {
    const cssContent = await this.cssContentPromise;

    const menuItems = [
      { label: this.translations.home || 'Home', action: 'show-home-and-close-others', icon: 'home' },
      { label: this.translations.todolist || 'Todo List', href: this.links.todolist || 'todolist.html', icon: 'list' },
      { label: this.translations.clock || 'Clock', href: this.links.clock || 'clock.html', icon: 'schedule' },
      { label: this.translations.calc || 'Calculator', href: this.links.calc || 'calc.html', icon: 'Function' },
      { label: this.translations.notes || 'Notes', href: this.links.notes || 'Notes.html', icon: 'note' },
      { label: this.translations.paint || 'Paint', href: this.links.paint || 'paint.html', icon: 'brush' },
    ];

    const menuHTML = `
      <div class="context-menu" id="contextMenu" style="left: ${pos.x}px; top: ${pos.y}px;">
        ${menuItems.map(item => `
          <div 
            class="menu-item" 
            ${item.href ? `data-href="${item.href}"` : ''}
            ${item.action ? `data-action="${item.action}"` : ''}
          >
            <span class="material-symbols-outlined">${item.icon}</span>
            <span class="menu-label">${item.label}</span>
          </div>
        `).join('')}
      </div>
    `;

    return { menuHTML, cssContent };
  }

  async createForTab(appId, pos) {
    const cssContent = await this.cssContentPromise;

    let appUrl;
    const lowerCaseAppId = appId.toLowerCase();

    // Find the link, ignoring case for robustness.
    for (const key in this.links) {
      if (key.toLowerCase() === lowerCaseAppId) {
        appUrl = this.links[key];
        break;
      }
    }

    // If not found in links, create a simple relative path. The main process will resolve it.
    if (!appUrl) {
      appUrl = `${lowerCaseAppId}.html`;
    }

    const menuItems = [
      { label: 'Reload', action: 'reload', icon: 'refresh' },
      {
        label: 'Duplicate',
        action: 'open-in-new-window',
        icon: 'content_copy',
        href: appUrl,
        title: appId
      },
      { type: 'separator' },
      { label: 'Close Tab', action: 'close', icon: 'close' },
      { label: 'Close Other Tabs', action: 'close-others', icon: 'tab_close' },
      { label: 'Close Tabs to the Right', action: 'close-right', icon: 'keyboard_tab_rtl' }
    ];

    const menuHTML = `
      <div class="context-menu" id="tabContextMenu" style="left: ${pos.x}px; top: ${pos.y}px;">
        ${menuItems.map(item => {
      if (item.type === 'separator') return '<div class="menu-separator"></div>';
      return `
            <div 
              class="menu-item" 
              data-action="${item.action}" 
              data-appid="${appId}"
              ${item.href ? `data-href="${item.href}"` : ''}
              ${item.title ? `data-title="${item.title}"` : ''}>
              <span class="material-symbols-outlined">${item.icon}</span>
              <span class="menu-label">${item.label}</span>
            </div>`;
    }).join('')}
      </div>
    `;

    return { menuHTML, cssContent };
  }
}

module.exports = ContextMenu;