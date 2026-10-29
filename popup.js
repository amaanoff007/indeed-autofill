const $ = id => document.getElementById(id);

function render() {
  chrome.storage.local.get({ log: [] }, ({ log }) => {
    const today = new Date().toDateString();
    $('count').textContent = log.length;
    $('today').textContent = log.filter(e => new Date(e.date).toDateString() === today).length;
    $('recent').innerHTML = '';
    log.slice(-8).reverse().forEach(e => {
      const li = document.createElement('li');
      li.textContent = `${e.title}${e.company ? ' — ' + e.company : ''}`;
      $('recent').appendChild(li);
    });
  });
}

$('fill').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: 'fill' }).catch(() => {});
  window.close();
};

$('export').onclick = () => {
  chrome.storage.local.get({ log: [] }, ({ log }) => {
    const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
    const csv = ['date,title,company,url', ...log.map(e => [e.date, e.title, e.company, e.url].map(esc).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `indeed-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  });
};

$('clear').onclick = () => {
  if (confirm('Clear the application log?')) chrome.storage.local.set({ log: [] }, render);
};

chrome.storage.local.get({ autoMode: false }, ({ autoMode }) => { $('auto').checked = autoMode; });
$('auto').onchange = () => chrome.storage.local.set({ autoMode: $('auto').checked });

render();
