const STEPS = [
  { title: 'Start with a screenshot', target: 'open', text: 'Press Alt/Option + Shift + V, or click Veil in your browser toolbar to capture a visible webpage. You can also open, drop, or paste a PNG, JPEG, or WebP here. Images stay on your device.' },
  { title: 'Find details you may want to hide', target: 'scan', text: 'Choose Find sensitive details. Local text recognition looks for emails, phone numbers, structured IDs, payment-card patterns, IP addresses, and clearly labeled names or addresses. English and Latin text work best. It will miss some details.' },
  { title: 'Review every suggestion', target: 'suggestion-panel', text: 'Amber outlines are suggestions, not redactions. Check the areas you want to hide, then choose Cover selected. Uncheck incorrect suggestions, or choose Dismiss suggestions. Suggestions never cover or export themselves.' },
  { title: 'Make manual corrections', target: 'canvas-wrap', text: 'Drag over anything the scan missed, including names, faces, QR codes, or avatars. Choose Ink, Paper, or a custom color. Change an existing cover using its color swatch. Undo/redo and Add by coordinates help you correct mistakes. Solid covers replace pixels on export; blur is not used.' },
  { title: 'Review and export', target: 'export', text: 'Resolve pending suggestions, inspect all sensitive details, then open the export preview. Inspect at 100%, confirm your review, and save the PNG or copy the image to your clipboard. Only applied solid covers are included. Discard the image when finished. You can reopen this guide from How it works at any time.' },
];

export function setupGuide({ onPractice }) {
  const dialog = document.getElementById('guide-dialog');
  const trigger = document.getElementById('help');
  let index = 0;
  let highlighted;
  function paint() {
    highlighted?.classList.remove('guide-target');
    const step = STEPS[index];
    document.getElementById('guide-step').textContent = `STEP ${index + 1} OF ${STEPS.length}`;
    document.getElementById('guide-title').textContent = step.title;
    document.getElementById('guide-copy').textContent = step.text;
    document.getElementById('guide-picture').src = `guide/step-${index + 1}.svg`;
    document.getElementById('guide-picture').alt = step.title + ' — illustrated example with fictional details';
    document.getElementById('guide-back').disabled = index === 0;
    document.getElementById('guide-next').textContent = index === STEPS.length - 1 ? 'Got it' : 'Next step →';
    highlighted = document.getElementById(step.target);
    highlighted?.classList.add('guide-target');
    // Keep navigation focused; the live region announces the changing title/text.
  }
  function open() {
    if (document.querySelector('dialog[open]')) return;
    index = 0; dialog.returnValue = ''; paint(); dialog.showModal();
  }
  trigger.addEventListener('click', open);
  document.getElementById('guide-back').addEventListener('click', () => { if (index > 0) { index--; paint(); } });
  document.getElementById('guide-next').addEventListener('click', () => {
    if (index === STEPS.length - 1) dialog.close(); else { index++; paint(); }
  });
  document.getElementById('guide-close').addEventListener('click', () => dialog.close());
  document.getElementById('guide-practice').addEventListener('click', () => { dialog.close(); onPractice(); });
  dialog.addEventListener('close', () => { highlighted?.classList.remove('guide-target'); trigger.focus(); });
  return { open };
}
