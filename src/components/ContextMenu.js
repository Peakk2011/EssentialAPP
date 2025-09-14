const { contextBridge } = require('electron');
const path = require('path');
const fs = require('fs');

class ContextMenu {
  constructor(translations, links, cssPath) {
    this.translations = translations;
    this.links = links;
    this.cssPath = cssPath;
  }

  async create(pos) {
    const cssContent = await fs.promises.readFile(this.cssPath, 'utf8');
    
    const menuItems = [
      { label: this.translations.home, action: 'show-home-and-close-others', icon: 'home' },
      { label: this.translations.todolist, href: this.links.todolist, icon: 'list' },
      { label: this.translations.clock, href: this.links.clock, icon: 'schedule' },
      { label: this.translations.calc, href: this.links.Calc, icon: 'Function' },
      { label: this.translations.notes, href: this.links.notes, icon: 'note' },
      { label: this.translations.paint, href: this.links.paint, icon: 'brush' },
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

  // createForTab mean contextmenu while you action on tabbar (titlebar)

  async createForTab(appId, pos) {
    const cssContent = await fs.promises.readFile(this.cssPath, 'utf8');

    const menuItems = [
      { label: 'Reload', action: 'reload', icon: 'refresh' },
      { label: 'Duplicate', action: 'duplicate', icon: 'content_copy' },
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
            <div class="menu-item" data-action="${item.action}" data-appid="${appId}">
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
