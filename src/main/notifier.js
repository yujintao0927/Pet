'use strict';
const { Notification } = require('electron');
const path = require('path');
const { openGameDetail } = require('./panelWindows');

function notifyGame({ title, body, eventId }) {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title,
    body,
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    silent: false,
  });
  n.on('click', () => {
    if (eventId) openGameDetail(eventId);
  });
  n.show();
}

module.exports = { notifyGame };
