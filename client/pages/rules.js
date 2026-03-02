function rollDice() {
    const d100Element = document.getElementById('d100');
    const d10Element = document.getElementById('d10');
    if (!d100Element || !d10Element) return;
    d100Element.classList.add('rolling');
    d10Element.classList.add('rolling');
    const d100Val = Math.floor(Math.random() * 10) * 10;
    const d10Val = Math.floor(Math.random() * 10);
    setTimeout(() => {
        d100Element.innerText = String(d100Val).padStart(2,'0');
        d10Element.innerText = d10Val;
    }, 300);
    setTimeout(() => {
        d100Element.classList.remove('rolling');
        d10Element.classList.remove('rolling');
    }, 600);
}

document.addEventListener('DOMContentLoaded', () => {
    // in case you want to auto-bind buttons by id
    const rollBtn = document.getElementById('rollBtn');
    if (rollBtn) rollBtn.addEventListener('click', rollDice);
});
