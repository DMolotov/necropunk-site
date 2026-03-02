function showSheet(num) {
    document.querySelectorAll('.sheet').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const sheet = document.getElementById('sheet' + num);
    const btn = document.getElementById('btn' + num);
    if (sheet) sheet.classList.add('active');
    if (btn) btn.classList.add('active');
}

function previewImage(input) {
    const preview = document.getElementById('photo-preview');
    if (!preview || !input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => preview.src = e.target.result;
    reader.readAsDataURL(input.files[0]);
}

function recalc(type) {
    const maxInput = document.getElementById(type + '_max');
    const curInput = document.getElementById(type + '_cur');
    const max = parseInt(maxInput && maxInput.value) || 0;
    const cur = parseInt(curInput && curInput.value) || 0;
    const v75 = Math.ceil(max * 0.75);
    const v50 = Math.ceil(max * 0.50);
    const v25 = Math.ceil(max * 0.25);
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setText(type + '_res_75', v75);
    setText(type + '_res_50', v50);
    setText(type + '_res_25', v25);
}

document.addEventListener('DOMContentLoaded', () => {
    recalc('os');
    recalc('oz');
});
