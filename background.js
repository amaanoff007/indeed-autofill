// Forward the Alt+Shift+F hotkey to every frame of the active tab.
chrome.commands.onCommand.addListener(async command => {
  if (command !== 'fill-form') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type: 'fill' }).catch(() => {});
});
