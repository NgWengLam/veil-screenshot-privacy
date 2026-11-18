/** Synthetic training image. No real people or customer data. */
export async function makeDemo() {
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 740;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f6f8'; ctx.fillRect(0, 0, 1200, 740);
  ctx.fillStyle = '#172b35'; ctx.fillRect(0, 0, 235, 740);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px sans-serif'; ctx.fillText('northstar', 30, 60);
  ctx.fillStyle = '#8fa5af'; ctx.font = '14px sans-serif'; ctx.fillText('DEMO WORKSPACE', 30, 89);
  ctx.fillStyle = '#2d454f'; ctx.fillRect(18, 143, 200, 46);
  ctx.fillStyle = '#ffffff'; ctx.font = '16px sans-serif'; ctx.fillText('Customer overview', 32, 172);
  ctx.fillStyle = '#b4c3ca'; ctx.fillText('Conversations', 32, 232); ctx.fillText('Reports', 32, 286);
  ctx.fillText('Settings', 32, 340);
  ctx.fillStyle = '#62747b'; ctx.font = '14px sans-serif'; ctx.fillText('CUSTOMERS  /  PROFILE', 280, 55);
  ctx.fillStyle = '#172b35'; ctx.font = 'bold 30px sans-serif'; ctx.fillText('Customer overview', 280, 104);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(280, 145, 870, 470);
  ctx.fillStyle = '#d8eae4'; ctx.beginPath(); ctx.arc(337, 202, 27, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#216457'; ctx.font = 'bold 17px sans-serif'; ctx.fillText('AL', 325, 208);
  ctx.fillStyle = '#172b35'; ctx.font = 'bold 22px sans-serif'; ctx.fillText('Alex Lee', 385, 202);
  ctx.fillStyle = '#66777e'; ctx.font = '14px sans-serif'; ctx.fillText('Example customer · Fictional details', 385, 228);
  const rows = [['EMAIL ADDRESS', 'alex.lee@example.com'], ['PHONE NUMBER', '+60 12-000 0000'], ['CUSTOMER REFERENCE', 'DEMO-10482']];
  rows.forEach(([label, value], i) => {
    const y = 292 + i * 94;
    ctx.fillStyle = '#66777e'; ctx.font = '12px sans-serif'; ctx.fillText(label, 315, y);
    ctx.fillStyle = '#172b35'; ctx.font = '20px sans-serif'; ctx.fillText(value, 315, y + 32);
    ctx.fillStyle = '#edf0f2'; ctx.fillRect(315, y + 55, 800, 1);
  });
  ctx.fillStyle = '#64767e'; ctx.font = '14px sans-serif'; ctx.fillText('Practice: cover the name, email, phone number, and reference before exporting.', 280, 675);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  canvas.width = canvas.height = 0;
  return blob;
}
