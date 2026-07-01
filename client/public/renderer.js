/**
 * =========================================
 * MAIL LABEL SYSTEM v3.2
 * 郵件標籤產生器 - 渲染模組
 * 格式：垂直堆疊
 *   寄件人：姓名               郵遞區號
 *   地址：...
 *   電話：...
 *
 *   收件人：姓名               郵遞區號
 *   地址：...
 *   電話：...
 *
 *   備註：
 * =========================================
 */

'use strict';

const MailLabelRenderer = {

  /**
   * HTML 跳脫，防止 XSS
   */
  escapeHtml: function(text) {
    const div = document.createElement('div');
    div.textContent = (text === undefined || text === null) ? '' : String(text);
    return div.innerHTML;
  },

  /**
   * 建立寄件人區塊
   * 第一行：寄件人：[姓名]        [郵遞區號]
   * 第二行：地址：[地址]
   * 第三行：電話：[電話]
   */
  createSenderSection: function(data) {
    data = data || {};
    const section = document.createElement('div');
    section.className = 'section sender-section';
    section.innerHTML = `
      <div class="info-row first-row">
        <span class="info-label">寄件人：</span><span class="info-value">${this.escapeHtml(data.name)}</span>
        <span class="info-zip-box">${this.escapeHtml(data.zip)}</span>
      </div>
      <div class="info-row"><span class="info-label">地址：</span><span class="info-value">${this.escapeHtml(data.address)}</span></div>
      <div class="info-row"><span class="info-label">電話：</span><span class="info-value">${this.escapeHtml(data.phone)}</span></div>
    `;
    return section;
  },

  /**
   * 建立收件人區塊
   * 第一行：收件人：[姓名(單位)]   [郵遞區號]
   * 第二行：地址：[地址]
   * 第三行：電話：[電話]
   */
  createRecipientSection: function(data) {
    data = data || {};
    // 姓名後括號標示單位
    const displayName = data.unit
      ? this.escapeHtml(data.name) + '（' + this.escapeHtml(data.unit) + '）'
      : this.escapeHtml(data.name);

    const section = document.createElement('div');
    section.className = 'section recipient-section';
    section.innerHTML = `
      <div class="info-row first-row">
        <span class="info-label">收件人：</span><span class="info-value">${displayName}</span>
        <span class="info-zip-box">${this.escapeHtml(data.zip)}</span>
      </div>
      <div class="info-row"><span class="info-label">地址：</span><span class="info-value">${this.escapeHtml(data.address)}</span></div>
      <div class="info-row"><span class="info-label">電話：</span><span class="info-value">${this.escapeHtml(data.phone)}</span></div>
    `;
    return section;
  },

  /**
   * 建立備註區塊
   */
  createNoteSection: function(note) {
    const section = document.createElement('div');
    section.className = 'section note-section';
    section.innerHTML = `<span class="info-label">備註：</span>`;
    if (note) {
      const span = document.createElement('span');
      span.className = 'note-text';
      span.textContent = note;
      section.appendChild(span);
    }
    return section;
  },

  /**
   * 建立單一標籤卡片
   */
  createLabel: function(data, index) {
    data = data || {};
    const label = document.createElement('div');
    label.className = 'label';
    label.dataset.index = (index === undefined) ? 0 : index;

    const body = document.createElement('div');
    body.className = 'label-body';
    body.appendChild(this.createSenderSection(data.sender));
    body.appendChild(this.createRecipientSection(data.recipient));
    body.appendChild(this.createNoteSection(data.note));
    label.appendChild(body);

    return label;
  },

  /**
   * 渲染標籤到容器
   */
  render: function(container, labels) {
    if (!container) {
      console.error('[MailLabelRenderer] container element not found');
      return false;
    }
    if (!Array.isArray(labels)) {
      console.error('[MailLabelRenderer] labels must be an array');
      return false;
    }
    container.innerHTML = '';
    labels.forEach((data, index) => {
      container.appendChild(this.createLabel(data, index));
    });
    return true;
  }
};
